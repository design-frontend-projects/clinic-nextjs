import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// Mock the Prisma singleton before importing the module under test.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profiles: { findFirst: vi.fn() },
    patients: { findFirst: vi.fn() },
  },
}));

import { prisma } from "@/lib/prisma";
import {
  findClinicDuplicate,
  duplicateMessage,
  roleNameToProfileRole,
  generateTempPassword,
} from "../user-creation";

const profilesFindFirst = prisma.profiles.findFirst as unknown as Mock;
const patientsFindFirst = prisma.patients.findFirst as unknown as Mock;

const CLINIC = "11111111-1111-1111-1111-111111111111";

describe("findClinicDuplicate", () => {
  beforeEach(() => {
    profilesFindFirst.mockReset();
    patientsFindFirst.mockReset();
    profilesFindFirst.mockResolvedValue(null);
    patientsFindFirst.mockResolvedValue(null);
  });

  it("returns null when neither email nor phone is provided", async () => {
    const result = await findClinicDuplicate({ clinicId: CLINIC });
    expect(result).toBeNull();
    expect(profilesFindFirst).not.toHaveBeenCalled();
    expect(patientsFindFirst).not.toHaveBeenCalled();
  });

  it("detects an email match in profiles", async () => {
    profilesFindFirst.mockResolvedValue({ email: "Doc@Clinic.com", phone: null });
    const result = await findClinicDuplicate({
      clinicId: CLINIC,
      email: "doc@clinic.com",
    });
    expect(result).toEqual({ field: "email", source: "profiles" });
  });

  it("detects a phone match in profiles when email was not the hit", async () => {
    profilesFindFirst.mockResolvedValue({ email: null, phone: "0100" });
    const result = await findClinicDuplicate({
      clinicId: CLINIC,
      email: "new@clinic.com",
      phone: "0100",
    });
    expect(result).toEqual({ field: "phone", source: "profiles" });
  });

  it("falls through to patients when profiles has no match", async () => {
    profilesFindFirst.mockResolvedValue(null);
    patientsFindFirst.mockResolvedValue({ email: null, phone: "0100" });
    const result = await findClinicDuplicate({ clinicId: CLINIC, phone: "0100" });
    expect(result).toEqual({ field: "phone", source: "patients" });
  });

  it("passes excludePatientId into the patients query", async () => {
    await findClinicDuplicate({
      clinicId: CLINIC,
      email: "x@y.com",
      excludePatientId: "patient-1",
    });
    const where = patientsFindFirst.mock.calls[0][0].where;
    expect(where.id).toEqual({ not: "patient-1" });
    expect(where.clinic_id).toBe(CLINIC);
  });

  it("normalizes email casing/whitespace and only queries provided fields", async () => {
    await findClinicDuplicate({ clinicId: CLINIC, email: "  A@B.COM  ", phone: "" });
    const or = profilesFindFirst.mock.calls[0][0].where.OR;
    expect(or).toEqual([{ email: { equals: "a@b.com", mode: "insensitive" } }]);
  });
});

describe("duplicateMessage", () => {
  it("labels a profiles match as a user", () => {
    expect(duplicateMessage({ field: "email", source: "profiles" })).toBe(
      "A user with this email already exists in this clinic.",
    );
  });

  it("labels a patients match as a patient", () => {
    expect(duplicateMessage({ field: "phone", source: "patients" })).toBe(
      "A patient with this phone already exists in this clinic.",
    );
  });
});

describe("roleNameToProfileRole", () => {
  it("maps Doctor to doctor", () => {
    expect(roleNameToProfileRole("Doctor")).toBe("doctor");
  });

  it("maps admin-tier roles to admin (case-insensitive)", () => {
    expect(roleNameToProfileRole("Administrator")).toBe("admin");
    expect(roleNameToProfileRole("tenant owner")).toBe("admin");
    expect(roleNameToProfileRole("Super Admin")).toBe("admin");
  });

  it("maps other roles and empties to staff", () => {
    expect(roleNameToProfileRole("Receptionist")).toBe("staff");
    expect(roleNameToProfileRole("Nurse")).toBe("staff");
    expect(roleNameToProfileRole("")).toBe("staff");
    expect(roleNameToProfileRole(null)).toBe("staff");
  });
});

describe("generateTempPassword", () => {
  it("has the requested length and all character classes", () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTempPassword(16);
      expect(pw).toHaveLength(16);
      expect(pw).toMatch(/[A-Z]/);
      expect(pw).toMatch(/[a-z]/);
      expect(pw).toMatch(/[0-9]/);
      expect(pw).toMatch(/[!@#$%^&*]/);
    }
  });

  it("produces distinct passwords", () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
  });
});
