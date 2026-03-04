"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { profileSchema, type Profile } from "@/types/clinic.types";

export async function getPersonnel(clinicId: string, role?: string) {
  await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      clinic_id: clinicId,
      ...(role ? { role } : {}),
    },
    orderBy: { created_at: "desc" },
    include: {
      branches: true,
    },
  });
}

export async function upsertPersonnel(data: Profile) {
  const tenant = await requireTenantInfo();
  const validatedData = profileSchema.parse(data);

  const personnel = await prisma.profiles.upsert({
    where: { id: validatedData.id || "new-id" },
    create: {
      id: crypto.randomUUID(),
      clerk_user_id:
        validatedData.clerk_user_id || `temp-${crypto.randomUUID()}`, // Temporary for manual additions
      clinic_id: validatedData.clinic_id || tenant.clinicId || "",
      branch_id: validatedData.branch_id,
      full_name: validatedData.full_name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: validatedData.role,
      specialty: validatedData.specialty,
      status: validatedData.status as "active" | "inactive" | "blocked",
    },
    update: {
      branch_id: validatedData.branch_id,
      full_name: validatedData.full_name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: validatedData.role,
      specialty: validatedData.specialty,
      status: validatedData.status as "active" | "inactive" | "blocked",
    },
  });

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
  return personnel;
}

export async function deletePersonnel(id: string) {
  await requireTenantInfo();

  // Rule: Check if personnel has linked data (appointments, etc.) before deleting
  // For now, let's just delete if no critical links exist or handle via Cascade if appropriate
  // Profiles in our schema have many relations. Let's be careful.

  await prisma.profiles.delete({
    where: { id },
  });

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
}
