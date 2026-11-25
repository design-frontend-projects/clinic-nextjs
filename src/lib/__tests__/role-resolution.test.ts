import { describe, expect, it } from "vitest";
import {
  canRunClinicOnboarding,
  extractActiveRbacRoleNames,
  isAppOwnerRoleName,
  resolveEffectiveProfileRole,
} from "../role-resolution";

describe("role-resolution", () => {
  describe("isAppOwnerRoleName", () => {
    it("matches app_owner variants case- and separator-insensitively", () => {
      expect(isAppOwnerRoleName("app_owner")).toBe(true);
      expect(isAppOwnerRoleName("App Owner")).toBe(true);
      expect(isAppOwnerRoleName("app-owner")).toBe(true);
      expect(isAppOwnerRoleName("  APP_OWNER ")).toBe(true);
    });

    it("does not match clinic roles or empty values", () => {
      expect(isAppOwnerRoleName("owner")).toBe(false);
      expect(isAppOwnerRoleName("super_admin")).toBe(false);
      expect(isAppOwnerRoleName("Super Admin")).toBe(false);
      expect(isAppOwnerRoleName("admin")).toBe(false);
      expect(isAppOwnerRoleName("")).toBe(false);
      expect(isAppOwnerRoleName(null)).toBe(false);
      expect(isAppOwnerRoleName(undefined)).toBe(false);
    });
  });

  describe("extractActiveRbacRoleNames", () => {
    it("extracts only active, non-deleted role names", () => {
      const names = extractActiveRbacRoleNames([
        {
          is_active: true,
          deleted_at: null,
          roles: { name: "app_owner", is_active: true, deleted_at: null },
        },
        {
          is_active: false,
          deleted_at: null,
          roles: { name: "Doctor", is_active: true, deleted_at: null },
        },
        {
          is_active: true,
          deleted_at: new Date(),
          roles: { name: "Admin", is_active: true, deleted_at: null },
        },
        {
          is_active: true,
          deleted_at: null,
          roles: { name: "InactiveRole", is_active: false, deleted_at: null },
        },
        {
          is_active: true,
          deleted_at: null,
          roles: { name: "DeletedRole", is_active: true, deleted_at: new Date() },
        },
      ]);

      expect(names).toEqual(["app_owner"]);
    });

    it("handles missing or empty arrays safely", () => {
      expect(extractActiveRbacRoleNames(undefined)).toEqual([]);
      expect(extractActiveRbacRoleNames(null)).toEqual([]);
      expect(extractActiveRbacRoleNames([])).toEqual([]);
    });
  });

  describe("resolveEffectiveProfileRole", () => {
    it("returns app_owner when profile.role is app_owner", () => {
      expect(resolveEffectiveProfileRole("app_owner", [])).toBe("app_owner");
    });

    it("falls back to active RBAC user_roles when profile.role is owner or unset", () => {
      expect(resolveEffectiveProfileRole("owner", ["App Owner"])).toBe(
        "app_owner",
      );
      expect(resolveEffectiveProfileRole(null, ["app_owner"])).toBe(
        "app_owner",
      );
    });

    it("keeps non-app-owner profile role when RBAC roles contain only clinic roles", () => {
      expect(resolveEffectiveProfileRole("doctor", ["Doctor", "Super Admin"])).toBe(
        "doctor",
      );
      expect(resolveEffectiveProfileRole("super_admin", ["Super Admin"])).toBe(
        "super_admin",
      );
      expect(resolveEffectiveProfileRole(null, [])).toBe("");
    });
  });

  describe("canRunClinicOnboarding", () => {
    it("allows only owners and unassigned profiles", () => {
      expect(canRunClinicOnboarding("owner")).toBe(true);
      expect(canRunClinicOnboarding(null)).toBe(true);
      expect(canRunClinicOnboarding(undefined)).toBe(true);
      expect(canRunClinicOnboarding("")).toBe(true);
    });

    it("blocks app_owner and all non-owner clinic roles", () => {
      for (const role of [
        "app_owner",
        "super_admin",
        "admin",
        "doctor",
        "staff",
        "receptionist",
        "pharmacist",
        "patient",
      ]) {
        expect(canRunClinicOnboarding(role)).toBe(false);
      }
    });
  });
});
