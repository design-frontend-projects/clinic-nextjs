"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import {
  clinicSchema,
  branchSchema,
  type ClinicLinkedBranch,
  type ClinicWithBranches,
  type OwnerBranchItem,
} from "@/types/clinic.types";
import { z } from "zod";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertValidUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`Invalid ${label} identifier`);
  }
}

function formatActionError(error: unknown, fallback: string): Error {
  if (error instanceof z.ZodError) {
    return new Error(error.issues[0]?.message || fallback);
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new Error("A branch with this name already exists");
    }
    if (error.code === "P2023") {
      return new Error("Invalid identifier provided");
    }
    if (error.code === "P2025") {
      return new Error("Record not found");
    }
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error(fallback);
}

/**
 * Resolve the owner's Supabase auth_user_id and the list of clinic IDs they own.
 * Works whether the caller is the owner or a delegated clinic admin.
 */
async function resolveOwnerScope(tenant: {
  clinicId: string;
  is_owner: boolean;
  auth_user_id: string;
}): Promise<{ ownerAuthId: string | null; ownerClinicIds: string[] }> {
  const current = await prisma.clinics.findUnique({
    where: { id: tenant.clinicId },
    select: { auth_user_id: true },
  });

  const ownerAuthId =
    current?.auth_user_id ?? (tenant.is_owner ? tenant.auth_user_id : null);

  if (!ownerAuthId) {
    return { ownerAuthId: null, ownerClinicIds: [tenant.clinicId] };
  }

  const owned = await prisma.clinics.findMany({
    where: { auth_user_id: ownerAuthId },
    select: { id: true },
  });

  const ownerClinicIds = Array.from(
    new Set([tenant.clinicId, ...owned.map((c) => c.id)]),
  );

  return { ownerAuthId, ownerClinicIds };
}

function branchOwnershipWhere(
  ownerAuthId: string | null,
  ownerClinicIds: string[],
): Prisma.branchesWhereInput {
  if (ownerAuthId) {
    return {
      OR: [
        { owner_id: ownerAuthId },
        { clinic_branches: { some: { clinic_id: { in: ownerClinicIds } } } },
      ],
    };
  }
  return {
    clinic_branches: { some: { clinic_id: { in: ownerClinicIds } } },
  };
}

/**
 * List clinics belonging to the caller's owner, each with its linked branches
 * ordered primary-first.
 */
export async function getClinics(): Promise<ClinicWithBranches[]> {
  const tenant = await requireTenantInfo();
  const { ownerAuthId } = await resolveOwnerScope(tenant);

  const clinics = await prisma.clinics.findMany({
    where: ownerAuthId
      ? { auth_user_id: ownerAuthId }
      : { id: tenant.clinicId },
    include: {
      clinic_branches: {
        include: {
          branches: true,
        },
        orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
      },
    },
    orderBy: [{ is_primary: "desc" }, { created_at: "desc" }],
  });

  return clinics.map((c) => ({
    id: c.id,
    name: c.name,
    registration_number: c.registration_number,
    email: c.email,
    phone: c.phone,
    subscription_plan: c.subscription_plan,
    status: c.status,
    is_primary: c.is_primary,
    have_pharmacy: c.have_pharmacy,
    have_lab: c.have_lab,
    have_radio_center: c.have_radio_center,
    created_at: c.created_at,
    branches: c.clinic_branches.map((cb) => ({
      id: cb.branches.id,
      name: cb.branches.name,
      address: cb.branches.address,
      phone: cb.branches.phone,
      status: cb.branches.status,
      is_primary: cb.is_primary,
      created_at: cb.branches.created_at,
    })),
  }));
}

/**
 * List all owner-level physical branches (along with the clinics each is linked to).
 */
export async function getOwnerBranches(): Promise<OwnerBranchItem[]> {
  const tenant = await requireTenantInfo();
  const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

  const branches = await prisma.branches.findMany({
    where: branchOwnershipWhere(ownerAuthId, ownerClinicIds),
    include: {
      clinic_branches: {
        where: { clinic_id: { in: ownerClinicIds } },
        include: {
          clinics: {
            select: { id: true, name: true },
          },
        },
        orderBy: { created_at: "asc" },
      },
    },
    orderBy: { created_at: "asc" },
  });

  return branches.map((b) => ({
    id: b.id,
    owner_id: b.owner_id,
    clinic_id: b.clinic_id,
    name: b.name,
    address: b.address,
    phone: b.phone,
    status: b.status,
    created_at: b.created_at,
    linked_clinics: b.clinic_branches.map((cb) => ({
      id: cb.clinics.id,
      name: cb.clinics.name,
      is_primary: cb.is_primary,
    })),
  }));
}

export async function createClinic(data: z.infer<typeof clinicSchema>) {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");

    const validatedData = clinicSchema.parse(data);
    const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

    const uniqueBranchIds = Array.from(new Set(validatedData.branch_ids));

    const ownedBranches = await prisma.branches.findMany({
      where: {
        AND: [
          { id: { in: uniqueBranchIds }, status: "active" },
          branchOwnershipWhere(ownerAuthId, ownerClinicIds),
        ],
      },
      select: { id: true },
    });

    if (ownedBranches.length !== uniqueBranchIds.length) {
      throw new Error(
        "One or more selected branches are invalid, inactive, or do not belong to your account",
      );
    }

    const primaryBranchId =
      validatedData.primary_branch_id &&
      uniqueBranchIds.includes(validatedData.primary_branch_id)
        ? validatedData.primary_branch_id
        : uniqueBranchIds[0];

    const clinic = await prisma.$transaction(async (tx) => {
      const newClinic = await tx.clinics.create({
        data: {
          id: crypto.randomUUID(),
          auth_user_id: ownerAuthId,
          name: validatedData.name,
          registration_number: validatedData.registration_number || null,
          email: validatedData.email || null,
          phone: validatedData.phone || null,
          subscription_plan: "trial",
          status: "trial",
          have_pharmacy: validatedData.have_pharmacy ?? false,
          have_lab: validatedData.have_lab ?? false,
          have_radio_center: validatedData.have_radio_center ?? false,
        },
      });

      await tx.clinic_branches.createMany({
        data: uniqueBranchIds.map((branchId) => ({
          clinic_id: newClinic.id,
          branch_id: branchId,
          is_primary: branchId === primaryBranchId,
        })),
      });

      return newClinic;
    });

    revalidatePath("/admin/clinics");
    return clinic;
  } catch (error) {
    throw formatActionError(error, "Failed to create clinic");
  }
}

export async function updateClinic(
  id: string,
  data: Partial<z.infer<typeof clinicSchema>>,
) {
  try {
    assertValidUuid(id, "clinic");
    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");
    const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

    if (!ownerClinicIds.includes(id)) {
      throw new Error("Unauthorized: clinic does not belong to your account");
    }

    const { branch_ids, primary_branch_id, id: _ignoredId, ...clinicFields } =
      data;

    let uniqueBranchIds: string[] | undefined;
    let resolvedPrimaryId: string | undefined;

    if (branch_ids !== undefined) {
      uniqueBranchIds = Array.from(new Set(branch_ids));
      if (uniqueBranchIds.length === 0) {
        throw new Error("A clinic must have at least one branch");
      }

      const ownedBranches = await prisma.branches.findMany({
        where: {
          AND: [
            { id: { in: uniqueBranchIds } },
            branchOwnershipWhere(ownerAuthId, ownerClinicIds),
          ],
        },
        select: { id: true, status: true },
      });
      if (ownedBranches.length !== uniqueBranchIds.length) {
        throw new Error(
          "One or more selected branches do not belong to your account",
        );
      }

      const currentLinks = await prisma.clinic_branches.findMany({
        where: { clinic_id: id },
        select: { branch_id: true, is_primary: true },
      });
      const currentSet = new Set(currentLinks.map((l) => l.branch_id));

      // Newly added branches must be active
      const inactiveNew = ownedBranches.find(
        (b) => !currentSet.has(b.id) && b.status !== "active",
      );
      if (inactiveNew) {
        throw new Error("Cannot link an inactive branch to a clinic");
      }

      const removedIds = currentLinks
        .map((l) => l.branch_id)
        .filter((bid) => !uniqueBranchIds!.includes(bid));

      if (removedIds.length > 0) {
        const futureAppointments = await prisma.appointments.count({
          where: {
            clinic_id: id,
            branch_id: { in: removedIds },
            appointment_date: { gte: new Date() },
          },
        });
        if (futureAppointments > 0) {
          throw new Error(
            "Cannot unlink a branch that has future appointments in this clinic",
          );
        }

        const [assignedHomeStaff, assignedMultiStaff] = await Promise.all([
          prisma.profiles.count({
            where: { tenant_id: id, branch_id: { in: removedIds } },
          }),
          prisma.profile_branches.count({
            where: { clinic_id: id, branch_id: { in: removedIds } },
          }),
        ]);
        if (assignedHomeStaff > 0 || assignedMultiStaff > 0) {
          throw new Error(
            "Cannot unlink a branch with assigned staff in this clinic. Reassign them first.",
          );
        }
      }

      const currentPrimary = currentLinks.find((l) => l.is_primary)?.branch_id;
      resolvedPrimaryId =
        primary_branch_id && uniqueBranchIds.includes(primary_branch_id)
          ? primary_branch_id
          : currentPrimary && uniqueBranchIds.includes(currentPrimary)
            ? currentPrimary
            : uniqueBranchIds[0];
    }

    const clinic = await prisma.$transaction(async (tx) => {
      const updated = await tx.clinics.update({
        where: { id },
        data: {
          ...clinicFields,
          updated_at: new Date(),
        },
      });

      if (uniqueBranchIds && resolvedPrimaryId) {
        await tx.clinic_branches.deleteMany({
          where: {
            clinic_id: id,
            branch_id: { notIn: uniqueBranchIds },
          },
        });

        // Clear existing primary before setting the new one to respect the
        // partial unique index (clinic_branches_one_primary_per_clinic_idx).
        await tx.clinic_branches.updateMany({
          where: { clinic_id: id, is_primary: true },
          data: { is_primary: false },
        });

        for (const branchId of uniqueBranchIds) {
          await tx.clinic_branches.upsert({
            where: {
              clinic_id_branch_id: {
                clinic_id: id,
                branch_id: branchId,
              },
            },
            create: {
              clinic_id: id,
              branch_id: branchId,
              is_primary: branchId === resolvedPrimaryId,
            },
            update: {
              is_primary: branchId === resolvedPrimaryId,
            },
          });
        }
      }

      return updated;
    });

    revalidatePath("/admin/clinics");
    return clinic;
  } catch (error) {
    throw formatActionError(error, "Failed to update clinic");
  }
}

/**
 * List every clinic owned by the same owner as the caller's current clinic.
 */
export async function getOwnerClinics() {
  const tenant = await requireTenantInfo();
  const { ownerAuthId } = await resolveOwnerScope(tenant);

  if (!ownerAuthId) {
    return prisma.clinics.findMany({
      where: { id: tenant.clinicId },
      select: { id: true, name: true, is_primary: true },
    });
  }

  return prisma.clinics.findMany({
    where: { auth_user_id: ownerAuthId },
    select: { id: true, name: true, is_primary: true },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });
}

/**
 * List branches linked to a specific clinic owned by the caller's owner.
 */
export async function getBranches(
  clinicId: string,
): Promise<(ClinicLinkedBranch & { clinic_id: string })[]> {
  assertValidUuid(clinicId, "clinic");
  const tenant = await requireTenantInfo();
  const { ownerClinicIds } = await resolveOwnerScope(tenant);

  if (!ownerClinicIds.includes(clinicId)) {
    throw new Error("Unauthorized: clinic does not belong to your account");
  }

  const links = await prisma.clinic_branches.findMany({
    where: { clinic_id: clinicId },
    include: { branches: true },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });

  return links.map((link) => ({
    id: link.branches.id,
    clinic_id: clinicId,
    name: link.branches.name,
    address: link.branches.address,
    phone: link.branches.phone,
    status: link.branches.status,
    is_primary: link.is_primary,
    created_at: link.branches.created_at,
  }));
}

/**
 * Every clinic owned by the caller's owner, each with its active linked branches.
 * Powers the doctor multi-clinic/multi-branch assignment editor.
 */
export async function getOwnerClinicsWithBranches() {
  const tenant = await requireTenantInfo();
  const { ownerAuthId } = await resolveOwnerScope(tenant);

  const where = ownerAuthId
    ? { auth_user_id: ownerAuthId }
    : { id: tenant.clinicId };

  const clinics = await prisma.clinics.findMany({
    where,
    select: {
      id: true,
      name: true,
      is_primary: true,
      clinic_branches: {
        where: { branches: { status: "active" as const } },
        select: {
          is_primary: true,
          branches: { select: { id: true, name: true, address: true } },
        },
        orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
      },
    },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });

  return clinics.map((c) => ({
    id: c.id,
    name: c.name,
    is_primary: c.is_primary,
    branches: c.clinic_branches.map((cb) => cb.branches),
  }));
}

/**
 * Create or update an owner-level branch.
 *
 * Uses explicit `create` vs `update` instead of `upsert({ where: { id: ... || "new-id" } })`
 * so PostgreSQL UUID validation never fails on creation. Also enforces
 * case-insensitive unique branch names per owner.
 */
export async function upsertBranch(data: z.infer<typeof branchSchema>) {
  try {
    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");

    const validatedData = branchSchema.parse(data);
    const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

    if (
      validatedData.clinic_id &&
      !ownerClinicIds.includes(validatedData.clinic_id)
    ) {
      throw new Error("Unauthorized: clinic does not belong to your account");
    }

    const trimmedName = validatedData.name.trim();

    // Case-insensitive duplicate check within the owner's branches.
    const duplicate = await prisma.branches.findFirst({
      where: {
        AND: [
          branchOwnershipWhere(ownerAuthId, ownerClinicIds),
          { name: { equals: trimmedName, mode: "insensitive" } },
          ...(validatedData.id ? [{ id: { not: validatedData.id } }] : []),
        ],
      },
      select: { id: true },
    });

    if (duplicate) {
      throw new Error("A branch with this name already exists");
    }

    if (validatedData.id) {
      const existing = await prisma.branches.findFirst({
        where: {
          AND: [
            { id: validatedData.id },
            branchOwnershipWhere(ownerAuthId, ownerClinicIds),
          ],
        },
        select: { id: true },
      });

      if (!existing) {
        throw new Error("Branch not found");
      }

      const updated = await prisma.branches.update({
        where: { id: validatedData.id },
        data: {
          name: trimmedName,
          address: validatedData.address?.trim() || null,
          phone: validatedData.phone?.trim() || null,
          status: validatedData.status as "active" | "inactive",
        },
      });

      revalidatePath("/admin/clinics");
      return updated;
    }

    const created = await prisma.$transaction(async (tx) => {
      const branch = await tx.branches.create({
        data: {
          id: crypto.randomUUID(),
          owner_id: ownerAuthId,
          clinic_id: validatedData.clinic_id ?? null,
          name: trimmedName,
          address: validatedData.address?.trim() || null,
          phone: validatedData.phone?.trim() || null,
          status: validatedData.status as "active" | "inactive",
        },
      });

      // Optional: if created inline from a clinic card, link it right away.
      if (validatedData.clinic_id) {
        const hasPrimary = await tx.clinic_branches.findFirst({
          where: { clinic_id: validatedData.clinic_id, is_primary: true },
          select: { id: true },
        });
        await tx.clinic_branches.create({
          data: {
            clinic_id: validatedData.clinic_id,
            branch_id: branch.id,
            is_primary: !hasPrimary,
          },
        });
      }

      return branch;
    });

    revalidatePath("/admin/clinics");
    return created;
  } catch (error) {
    throw formatActionError(error, "Failed to save branch");
  }
}

/**
 * Link an existing owner branch to one of the owner's clinics.
 */
export async function linkBranchToClinic(
  clinicId: string,
  branchId: string,
  isPrimary = false,
) {
  try {
    assertValidUuid(clinicId, "clinic");
    assertValidUuid(branchId, "branch");

    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");
    const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

    if (!ownerClinicIds.includes(clinicId)) {
      throw new Error("Unauthorized: clinic does not belong to your account");
    }

    const branch = await prisma.branches.findFirst({
      where: {
        AND: [
          { id: branchId },
          branchOwnershipWhere(ownerAuthId, ownerClinicIds),
        ],
      },
      select: { id: true, status: true },
    });

    if (!branch) {
      throw new Error("Branch not found");
    }
    if (branch.status !== "active") {
      throw new Error("Cannot link an inactive branch to a clinic");
    }

    await prisma.$transaction(async (tx) => {
      const existing = await tx.clinic_branches.findUnique({
        where: {
          clinic_id_branch_id: { clinic_id: clinicId, branch_id: branchId },
        },
      });

      const hasPrimary = await tx.clinic_branches.findFirst({
        where: { clinic_id: clinicId, is_primary: true },
        select: { id: true },
      });

      const shouldBePrimary = isPrimary || !hasPrimary;

      if (shouldBePrimary && hasPrimary) {
        await tx.clinic_branches.updateMany({
          where: { clinic_id: clinicId, is_primary: true },
          data: { is_primary: false },
        });
      }

      if (existing) {
        if (shouldBePrimary && !existing.is_primary) {
          await tx.clinic_branches.update({
            where: { id: existing.id },
            data: { is_primary: true },
          });
        }
      } else {
        await tx.clinic_branches.create({
          data: {
            clinic_id: clinicId,
            branch_id: branchId,
            is_primary: shouldBePrimary,
          },
        });
      }
    });

    revalidatePath("/admin/clinics");
    return { success: true };
  } catch (error) {
    throw formatActionError(error, "Failed to link branch to clinic");
  }
}

/**
 * Unlink a branch from a clinic (without deleting the physical branch).
 */
export async function unlinkBranchFromClinic(
  clinicId: string,
  branchId: string,
) {
  try {
    assertValidUuid(clinicId, "clinic");
    assertValidUuid(branchId, "branch");

    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");
    const { ownerClinicIds } = await resolveOwnerScope(tenant);

    if (!ownerClinicIds.includes(clinicId)) {
      throw new Error("Unauthorized: clinic does not belong to your account");
    }

    const links = await prisma.clinic_branches.findMany({
      where: { clinic_id: clinicId },
      orderBy: { created_at: "asc" },
    });

    const target = links.find((l) => l.branch_id === branchId);
    if (!target) {
      throw new Error("Branch is not linked to this clinic");
    }

    if (links.length <= 1) {
      throw new Error(
        "A clinic must keep at least one branch. Link another branch first.",
      );
    }

    const futureAppointments = await prisma.appointments.count({
      where: {
        clinic_id: clinicId,
        branch_id: branchId,
        appointment_date: { gte: new Date() },
      },
    });
    if (futureAppointments > 0) {
      throw new Error(
        "Cannot unlink branch with future appointments in this clinic",
      );
    }

    const [assignedHomeStaff, assignedMultiStaff] = await Promise.all([
      prisma.profiles.count({
        where: { tenant_id: clinicId, branch_id: branchId },
      }),
      prisma.profile_branches.count({
        where: { clinic_id: clinicId, branch_id: branchId },
      }),
    ]);

    if (assignedHomeStaff > 0 || assignedMultiStaff > 0) {
      throw new Error(
        "Cannot unlink a branch with assigned staff in this clinic. Reassign them first.",
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.clinic_branches.delete({
        where: { id: target.id },
      });

      if (target.is_primary) {
        const nextPrimary = links.find((l) => l.id !== target.id);
        if (nextPrimary) {
          await tx.clinic_branches.update({
            where: { id: nextPrimary.id },
            data: { is_primary: true },
          });
        }
      }
    });

    revalidatePath("/admin/clinics");
    return { success: true };
  } catch (error) {
    throw formatActionError(error, "Failed to unlink branch from clinic");
  }
}

/**
 * Mark a linked branch as the primary branch for a clinic.
 */
export async function setClinicPrimaryBranch(
  clinicId: string,
  branchId: string,
) {
  try {
    assertValidUuid(clinicId, "clinic");
    assertValidUuid(branchId, "branch");

    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");
    const { ownerClinicIds } = await resolveOwnerScope(tenant);

    if (!ownerClinicIds.includes(clinicId)) {
      throw new Error("Unauthorized: clinic does not belong to your account");
    }

    const target = await prisma.clinic_branches.findUnique({
      where: {
        clinic_id_branch_id: { clinic_id: clinicId, branch_id: branchId },
      },
      select: { id: true },
    });

    if (!target) {
      throw new Error("Branch is not linked to this clinic");
    }

    await prisma.$transaction(async (tx) => {
      await tx.clinic_branches.updateMany({
        where: { clinic_id: clinicId, is_primary: true },
        data: { is_primary: false },
      });
      await tx.clinic_branches.update({
        where: { id: target.id },
        data: { is_primary: true },
      });
    });

    revalidatePath("/admin/clinics");
    return { success: true };
  } catch (error) {
    throw formatActionError(error, "Failed to set primary branch");
  }
}

/**
 * Delete an owner-level physical branch.
 * Blocked if future appointments exist, staff are assigned, or it is the last
 * remaining branch of any clinic.
 */
export async function deleteBranch(id: string) {
  try {
    assertValidUuid(id, "branch");
    const tenant = await requireTenantInfo();
    await requirePermission("clinic.manage");
    const { ownerAuthId, ownerClinicIds } = await resolveOwnerScope(tenant);

    const branch = await prisma.branches.findFirst({
      where: {
        AND: [{ id }, branchOwnershipWhere(ownerAuthId, ownerClinicIds)],
      },
      select: { id: true },
    });
    if (!branch) {
      throw new Error("Branch not found");
    }

    const appointmentCount = await prisma.appointments.count({
      where: {
        branch_id: id,
        appointment_date: { gte: new Date() },
      },
    });
    if (appointmentCount > 0) {
      throw new Error("Cannot delete branch with future appointments");
    }

    const [assignedProfiles, assignedDoctorLinks] = await Promise.all([
      prisma.profiles.count({ where: { branch_id: id } }),
      prisma.profile_branches.count({ where: { branch_id: id } }),
    ]);

    if (assignedProfiles > 0 || assignedDoctorLinks > 0) {
      throw new Error(
        "Cannot delete a branch with assigned staff. Reassign them to another branch first.",
      );
    }

    // Check if this branch is the last remaining branch of any linked clinic.
    const clinicLinks = await prisma.clinic_branches.findMany({
      where: { branch_id: id },
      include: {
        clinics: {
          select: {
            id: true,
            name: true,
            _count: { select: { clinic_branches: true } },
          },
        },
      },
    });

    const soleBranchClinic = clinicLinks.find(
      (l) => l.clinics._count.clinic_branches <= 1,
    );
    if (soleBranchClinic) {
      throw new Error(
        `Cannot delete this branch because it is the only branch for "${soleBranchClinic.clinics.name}". Link another branch to that clinic first.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      // Promote another branch to primary for any clinic where this was primary.
      for (const link of clinicLinks) {
        if (link.is_primary) {
          const replacement = await tx.clinic_branches.findFirst({
            where: {
              clinic_id: link.clinic_id,
              branch_id: { not: id },
            },
            orderBy: { created_at: "asc" },
            select: { id: true },
          });
          await tx.clinic_branches.delete({ where: { id: link.id } });
          if (replacement) {
            await tx.clinic_branches.update({
              where: { id: replacement.id },
              data: { is_primary: true },
            });
          }
        }
      }

      await tx.branches.delete({
        where: { id },
      });
    });

    revalidatePath("/admin/clinics");
  } catch (error) {
    throw formatActionError(error, "Failed to delete branch");
  }
}
