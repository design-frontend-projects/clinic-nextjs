// src/features/rbac/__tests__/rbac.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RoleCreateSchema, PermissionCreateSchema } from "../domain/dtos";
import { EvaluationService } from "../services/evaluation.service";
import { RBACRepository } from "../repositories/rbac.repository";

// Mock Repository
vi.mock("../repositories/rbac.repository", () => {
  const mockInstances: any[] = [];
  class MockRBACRepository {
    findTenantPermissions = vi.fn().mockResolvedValue([]);
    findUserPermissions = vi.fn().mockResolvedValue([]);
    findUserRoles = vi.fn().mockResolvedValue([]);
    findRoleHierarchy = vi.fn().mockResolvedValue([]);
    findRolePermissions = vi.fn().mockResolvedValue([]);
    findPermissions = vi.fn().mockResolvedValue([]);
    createAuditLog = vi.fn();
    createRole = vi.fn();
    updateRole = vi.fn();
    softDeleteRole = vi.fn();

    constructor() {
      mockInstances.push(this);
    }
  }
  return {
    RBACRepository: MockRBACRepository,
    _mockInstances: mockInstances
  };
});

// Mock Cache
vi.mock("../services/cache.service", () => {
  return {
    cacheService: {
      getRoleHierarchy: vi.fn().mockResolvedValue(null),
      setRoleHierarchy: vi.fn(),
      getUserPermissions: vi.fn().mockResolvedValue(null),
      setUserPermissions: vi.fn(),
      getUserRoles: vi.fn().mockResolvedValue(null),
      setUserRoles: vi.fn(),
    }
  };
});

describe("Zod DTO Validations", () => {
  it("should fail validation for reserved role names", () => {
    const result = RoleCreateSchema.safeParse({
      name: "Administrator",
      description: "Test description"
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("This role name is reserved by the system");
    }
  });

  it("should succeed validation for custom role names", () => {
    const result = RoleCreateSchema.safeParse({
      name: "Nurse Assistant",
      description: "Test description"
    });
    expect(result.success).toBe(true);
  });

  it("should fail validation for invalid permission naming conventions", () => {
    const result = PermissionCreateSchema.safeParse({
      name: "patientcreate",
      description: "Invalid naming"
    });
    expect(result.success).toBe(false);
  });

  it("should pass validation for valid dot-notation permission conventions", () => {
    const result = PermissionCreateSchema.safeParse({
      name: "patient.create",
      description: "Valid naming"
    });
    expect(result.success).toBe(true);

    const subResult = PermissionCreateSchema.safeParse({
      name: "inventory.stock.transfer",
      description: "Valid sub-module naming"
    });
    expect(subResult.success).toBe(true);
  });
});

describe("Permission Evaluation Priority Engine", () => {
  let mockRepo: any;
  let service: EvaluationService;

  const tenantId = "00000000-0000-0000-0000-000000000001";
  const profileId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo = new RBACRepository();
    service = new EvaluationService(mockRepo);

    // Default tenant supports all permissions
    mockRepo.findTenantPermissions.mockResolvedValue([]);
    mockRepo.findUserPermissions.mockResolvedValue([]);
    mockRepo.findUserRoles.mockResolvedValue([]);
    mockRepo.findRoleHierarchy.mockResolvedValue([]);
    mockRepo.findRolePermissions.mockResolvedValue([]);
  });

  it("should evaluate to DEFAULT DENY when no overrides exist", async () => {
    const res = await service.evaluatePermission(tenantId, profileId, "patient.create");
    expect(res.allowed).toBe(false);
    expect(res.evaluatedBy).toBe("DEFAULT");
  });

  it("should allow when user has explicit direct allow override", async () => {
    mockRepo.findUserPermissions.mockResolvedValue([
      {
        id: "1",
        is_deny: false,
        expires_at: null,
        permissions: { id: "p1", name: "patient.create" }
      }
    ]);

    const res = await service.evaluatePermission(tenantId, profileId, "patient.create");
    expect(res.allowed).toBe(true);
    expect(res.evaluatedBy).toBe("EXPLICIT_ALLOW");
  });

  it("should deny when user has explicit direct deny override even if role allows", async () => {
    // Role allows
    mockRepo.findUserRoles.mockResolvedValue([
      { role_id: "r1", roles: { id: "r1", name: "Doctor" } }
    ]);
    mockRepo.findRolePermissions.mockResolvedValue([
      { role_id: "r1", is_deny: false, permissions: { id: "p1", name: "patient.create" } }
    ]);

    // Direct denies
    mockRepo.findUserPermissions.mockResolvedValue([
      {
        id: "1",
        is_deny: true,
        expires_at: null,
        permissions: { id: "p1", name: "patient.create" }
      }
    ]);

    const res = await service.evaluatePermission(tenantId, profileId, "patient.create");
    expect(res.allowed).toBe(false);
    expect(res.evaluatedBy).toBe("EXPLICIT_DENY");
    expect(res.reason).toContain("direct deny override");
  });

  it("should evaluate role hierarchy inheritance", async () => {
    // User is Doctor
    mockRepo.findUserRoles.mockResolvedValue([
      { role_id: "r1", roles: { id: "r1", name: "Doctor" } }
    ]);

    // Doctor inherits from Staff
    mockRepo.findRoleHierarchy.mockResolvedValue([
      { parent_role_id: "r1", child_role_id: "r2" }
    ]);

    // Staff has patient.read
    mockRepo.findRolePermissions.mockImplementation(async (tId: string, roleId: string) => {
      if (roleId === "r2") {
        return [{ role_id: "r2", is_deny: false, permissions: { id: "p2", name: "patient.read" } }];
      }
      return [];
    });

    const res = await service.evaluatePermission(tenantId, profileId, "patient.read");
    expect(res.allowed).toBe(true);
    expect(res.evaluatedBy).toBe("INHERITED");
    expect(res.inheritedFromRoleId).toBe("r2");
  });

  it("should deny when parent permission is blocked by tenant subscription restriction", async () => {
    // Direct allows patient.create
    mockRepo.findUserPermissions.mockResolvedValue([
      {
        id: "1",
        is_deny: false,
        expires_at: null,
        permissions: { id: "p1", name: "patient.create" }
      }
    ]);

    // Tenant ONLY supports billing
    mockRepo.findTenantPermissions.mockResolvedValue([
      { permissions: { id: "p2", name: "invoice.read" } }
    ]);

    const res = await service.evaluatePermission(tenantId, profileId, "patient.create");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("Tenant subscription does not support");
  });

  it("should deny temporary permission once it expires", async () => {
    const pastDate = new Date(Date.now() - 10000);
    mockRepo.findUserPermissions.mockResolvedValue([
      {
        id: "1",
        is_deny: false,
        expires_at: pastDate,
        permissions: { id: "p1", name: "patient.create" }
      }
    ]);

    const res = await service.evaluatePermission(tenantId, profileId, "patient.create");
    expect(res.allowed).toBe(false);
    expect(res.evaluatedBy).toBe("DEFAULT");
  });

  it("should match wildcard and module-level permissions", async () => {
    // User has patient.manage
    mockRepo.findUserPermissions.mockResolvedValue([
      {
        id: "1",
        is_deny: false,
        expires_at: null,
        permissions: { id: "p1", name: "patient.manage" }
      }
    ]);

    const res1 = await service.evaluatePermission(tenantId, profileId, "patient.create");
    const res2 = await service.evaluatePermission(tenantId, profileId, "patient.read");

    expect(res1.allowed).toBe(true);
    expect(res2.allowed).toBe(true);
  });
});
