"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import { cookies } from "next/headers";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function updateProfileBranch(branchId: string) {
  const tenant = await requireTenantInfo();

  if (tenant.role === "doctor") {
    // Doctors switch only among the branches they're assigned to within their
    // active clinic (validated against profile_branches).
    const assigned = await prisma.profile_branches.findFirst({
      where: {
        profile_id: tenant.profileId,
        branch_id: branchId,
        clinic_id: tenant.clinicId,
      },
      select: { id: true },
    });
    if (!assigned) {
      throw new Error("You are not assigned to this branch");
    }
  } else {
    // Other branch-locked roles cannot switch; their branch is admin-assigned.
    if (tenant.branchLocked) {
      throw new Error("Your branch is assigned by your clinic administrator");
    }
    // Owners/admins may switch to any branch in their clinic.
    const branch = await prisma.branches.findFirst({
      where: { id: branchId, clinic_id: tenant.clinicId },
      select: { id: true },
    });
    if (!branch) {
      throw new Error("Invalid branch for this clinic");
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("active_branch_id", branchId, {
    path: "/",
    maxAge: ONE_YEAR,
  });

  revalidatePath("/");
}

/**
 * Switch the doctor's active clinic. Validates the clinic is one they're
 * assigned to, sets the `active_clinic_id` cookie, and resets `active_branch_id`
 * to that clinic's primary (or first) assigned branch so the branch context is
 * never left pointing at a branch in the previous clinic.
 */
export async function setActiveClinic(clinicId: string) {
  const tenant = await requireTenantInfo();

  const assignment = await prisma.profile_branches.findFirst({
    where: { profile_id: tenant.profileId, clinic_id: clinicId },
    select: { branch_id: true },
    orderBy: { is_primary: "desc" },
  });
  if (!assignment) {
    throw new Error("You are not assigned to this clinic");
  }

  const cookieStore = await cookies();
  cookieStore.set("active_clinic_id", clinicId, {
    path: "/",
    maxAge: ONE_YEAR,
  });
  cookieStore.set("active_branch_id", assignment.branch_id, {
    path: "/",
    maxAge: ONE_YEAR,
  });

  revalidatePath("/");
}

export interface MyAssignments {
  clinics: { id: string; name: string }[];
  branches: {
    id: string;
    name: string;
    address: string | null;
    clinic_id: string;
  }[];
}

/**
 * The doctor's assigned clinics + branches, for the top-bar clinic/branch
 * switchers. Returns empty lists for non-doctors (or doctors without
 * assignments), so the header can fall back to the read-only display.
 */
export async function getMyAssignments(): Promise<MyAssignments> {
  const tenant = await requireTenantInfo();
  if (tenant.role !== "doctor") return { clinics: [], branches: [] };

  const rows = await prisma.profile_branches.findMany({
    where: { profile_id: tenant.profileId },
    select: {
      is_primary: true,
      clinics: { select: { id: true, name: true } },
      branches: { select: { id: true, name: true, address: true } },
    },
    orderBy: [{ is_primary: "desc" }],
  });

  const clinicMap = new Map<string, { id: string; name: string }>();
  const branches: MyAssignments["branches"] = [];
  for (const r of rows) {
    if (!clinicMap.has(r.clinics.id)) {
      clinicMap.set(r.clinics.id, { id: r.clinics.id, name: r.clinics.name });
    }
    branches.push({
      id: r.branches.id,
      name: r.branches.name,
      address: r.branches.address,
      clinic_id: r.clinics.id,
    });
  }

  return { clinics: [...clinicMap.values()], branches };
}
