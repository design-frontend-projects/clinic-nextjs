"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { revalidatePath } from "next/cache";
import { clinicSchema, branchSchema } from "@/types/clinic.types";
import { z } from "zod";

export async function getClinics() {
  await requireTenantInfo();

  // Fetch all clinics and display them (with included branches)
  return prisma.clinics.findMany({
    include: {
      branches: true,
    },
    orderBy: {
      created_at: "desc",
    },
  });
}

export async function createClinic(data: z.infer<typeof clinicSchema>) {
  await requireTenantInfo();
  await requirePermission("clinic.manage");

  const validatedData = clinicSchema.parse(data);

  const clinic = await prisma.$transaction(async (tx) => {
    const newClinic = await tx.clinics.create({
      data: {
        id: crypto.randomUUID(), // Assuming UUID is not auto-generated in schema or handled by Prisma
        name: validatedData.name,
        registration_number: validatedData.registration_number,
        email: validatedData.email,
        phone: validatedData.phone,
        subscription_plan: "trial", // Rule: Trial plan auto-assign
        status: "trial",
      },
    });

    // Rule: One main branch is required
    await tx.branches.create({
      data: {
        id: crypto.randomUUID(),
        clinic_id: newClinic.id,
        name: "Main Branch",
        status: "active",
      },
    });

    return newClinic;
  });

  revalidatePath("/admin/clinics");
  return clinic;
}

export async function updateClinic(
  id: string,
  data: Partial<z.infer<typeof clinicSchema>>,
) {
  await requireTenantInfo();
  await requirePermission("clinic.manage");

  const clinic = await prisma.clinics.update({
    where: { id },
    data: {
      ...data,
      updated_at: new Date(),
    },
  });

  revalidatePath("/admin/clinics");
  return clinic;
}

export async function getBranches(clinicId: string) {
  const tenant = await requireTenantInfo();
  // Only ever list branches for the caller's own clinic — ignore any other id
  // passed from the client (prevents cross-tenant branch enumeration).
  if (clinicId !== tenant.clinicId) {
    throw new Error("Unauthorized: branch does not belong to this clinic");
  }
  return prisma.branches.findMany({
    where: { clinic_id: tenant.clinicId },
    orderBy: { created_at: "asc" },
  });
}

export async function upsertBranch(data: z.infer<typeof branchSchema>) {
  const tenant = await requireTenantInfo();
  await requirePermission("clinic.manage");
  const validatedData = branchSchema.parse(data);

  // Branches can only be created/edited within the caller's own clinic.
  if (validatedData.clinic_id !== tenant.clinicId) {
    throw new Error("Unauthorized: branch does not belong to this clinic");
  }
  // On edit, verify the target branch is actually in this clinic.
  if (validatedData.id) {
    const existing = await prisma.branches.findFirst({
      where: { id: validatedData.id, clinic_id: tenant.clinicId },
      select: { id: true },
    });
    if (!existing) {
      throw new Error("Branch not found in this clinic");
    }
  }

  const branch = await prisma.branches.upsert({
    where: { id: validatedData.id || "new-id" },
    create: {
      id: crypto.randomUUID(),
      clinic_id: tenant.clinicId,
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      status: validatedData.status as "active" | "inactive",
    },
    update: {
      name: validatedData.name,
      address: validatedData.address,
      phone: validatedData.phone,
      status: validatedData.status as "active" | "inactive",
    },
  });

  revalidatePath("/admin/clinics");
  return branch;
}

export async function deleteBranch(id: string) {
  const tenant = await requireTenantInfo();
  await requirePermission("clinic.manage");

  // Ensure the branch belongs to the caller's clinic before any check/delete
  // (prevents cross-tenant branch deletion).
  const branch = await prisma.branches.findFirst({
    where: { id, clinic_id: tenant.clinicId },
    select: { id: true },
  });
  if (!branch) {
    throw new Error("Branch not found in this clinic");
  }

  // Rule: Branch cannot be deleted if future appointments exist
  const appointmentCount = await prisma.appointments.count({
    where: {
      branch_id: id,
      appointment_date: { gte: new Date() },
    },
  });

  if (appointmentCount > 0) {
    throw new Error("Cannot delete branch with future appointments");
  }

  // Rule: Branch cannot be deleted while personnel are assigned to it
  const assignedProfiles = await prisma.profiles.count({
    where: { branch_id: id },
  });

  if (assignedProfiles > 0) {
    throw new Error(
      "Cannot delete a branch with assigned staff. Reassign them to another branch first.",
    );
  }

  await prisma.branches.delete({
    where: { id },
  });

  revalidatePath("/admin/clinics");
}
