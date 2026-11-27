import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { PrismaClient } from "@prisma/client";

type GlobalPrismaState = {
  prismaBase?: PrismaClient;
  prismaExtended?: PrismaClient;
  prismaSchemaMtime?: number | null;
};

describe("prisma client schema cache validation", () => {
  const globalState = globalThis as unknown as GlobalPrismaState;
  const originalBase = globalState.prismaBase;
  const originalExtended = globalState.prismaExtended;
  const originalMtime = globalState.prismaSchemaMtime;

  beforeEach(() => {
    delete globalState.prismaBase;
    delete globalState.prismaExtended;
    delete globalState.prismaSchemaMtime;
  });

  afterEach(() => {
    globalState.prismaBase = originalBase;
    globalState.prismaExtended = originalExtended;
    globalState.prismaSchemaMtime = originalMtime;
  });

  it("rejects stale clients missing clinic_branches or branches.owner_id", async () => {
    const { hasCurrentSchema } = await import("@/lib/prisma");

    const missingClinicBranches = {
      billing_catalog_items: {},
      _runtimeDataModel: {
        models: {
          insurance_providers: {
            fields: [{ name: "consultation_deduction_type" }],
          },
          branches: {
            fields: [{ name: "owner_id" }],
          },
        },
      },
    } as unknown as PrismaClient;

    const missingBranchOwnerId = {
      billing_catalog_items: {},
      clinic_branches: {},
      _runtimeDataModel: {
        models: {
          insurance_providers: {
            fields: [{ name: "consultation_deduction_type" }],
          },
          branches: {
            fields: [{ name: "clinic_id" }],
          },
        },
      },
    } as unknown as PrismaClient;

    const currentClient = {
      billing_catalog_items: {},
      clinic_branches: {},
      patient_body_charts: {},
      _runtimeDataModel: {
        models: {
          insurance_providers: {
            fields: [{ name: "consultation_deduction_type" }],
          },
          branches: {
            fields: [{ name: "owner_id" }],
          },
          clinics: {
            fields: [{ name: "specialty_id" }],
          },
        },
      },
    } as unknown as PrismaClient;

    expect(hasCurrentSchema(undefined)).toBe(false);
    expect(hasCurrentSchema(missingClinicBranches)).toBe(false);
    expect(hasCurrentSchema(missingBranchOwnerId)).toBe(false);
    expect(hasCurrentSchema(currentClient)).toBe(true);
  });

  it("replaces a stale globalThis.prismaBase lacking clinic_branches with a fresh client", async () => {
    const staleBase = {
      billing_catalog_items: {},
      _runtimeDataModel: {
        models: {
          insurance_providers: {
            fields: [{ name: "consultation_deduction_type" }],
          },
        },
      },
    } as unknown as PrismaClient;

    globalState.prismaBase = staleBase;
    globalState.prismaExtended = staleBase;
    globalState.prismaSchemaMtime = 0;

    const { prisma, prismaBase } = await import("@/lib/prisma");

    expect("clinic_branches" in prisma).toBe(true);
    expect(typeof prisma.clinic_branches.findFirst).toBe("function");
    expect("clinic_branches" in prismaBase).toBe(true);
    expect(typeof prismaBase.clinic_branches.findFirst).toBe("function");
    expect(globalState.prismaBase).not.toBe(staleBase);
  });
});
