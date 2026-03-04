"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
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
  const tenant = await requireTenantInfo();

  // Rule: Only Org Owner can create a clinic (Assumption: user role check)
  if (tenant.role !== "admin") {
    throw new Error("Only admins can create clinics");
  }

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
  await requireTenantInfo();
  return prisma.branches.findMany({
    where: { clinic_id: clinicId },
    orderBy: { created_at: "asc" },
  });
}

export async function upsertBranch(data: z.infer<typeof branchSchema>) {
  await requireTenantInfo();
  const validatedData = branchSchema.parse(data);

  const branch = await prisma.branches.upsert({
    where: { id: validatedData.id || "new-id" },
    create: {
      id: crypto.randomUUID(),
      clinic_id: validatedData.clinic_id,
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
  await requireTenantInfo();

  // Rule: Branch cannot be deleted if doctors assigned or future appointments exist
  const [doctorCount, appointmentCount] = await Promise.all([
    prisma.profiles.count({ where: { branch_id: id } }),
    prisma.appointments.count({
      where: {
        branch_id: id,
        appointment_date: { gte: new Date() },
      },
    }),
  ]);

  if (doctorCount > 0) {
    throw new Error("Cannot delete branch with assigned doctors");
  }

  if (appointmentCount > 0) {
    throw new Error("Cannot delete branch with future appointments");
  }

  await prisma.branches.delete({
    where: { id },
  });

  revalidatePath("/admin/clinics");
}
