"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { profileSchema, type Profile } from "@/types/clinic.types";
import { clerkClient } from "@clerk/nextjs/server";

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

  const isNewRecord = !validatedData.id;

  const personnel = await prisma.profiles.upsert({
    where: { id: validatedData.id || "new-id" },
    create: {
      id: crypto.randomUUID(),
      clerk_user_id:
        validatedData.clerk_user_id || `temp-${crypto.randomUUID()}`,
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

  // Send Clerk organization invitation for new personnel with a valid email
  if (isNewRecord && validatedData.email && tenant.orgId) {
    try {
      const client = await clerkClient();
      await client.organizations.createOrganizationInvitation({
        organizationId: tenant.orgId,
        inviterUserId: tenant.userId,
        emailAddress: validatedData.email,
        role: "org:member",
        publicMetadata: {
          profileId: personnel.id,
          internalRole: validatedData.role,
        },
      });
    } catch (error) {
      // Log but don't fail the profile creation
      console.error(
        "[Clerk Invitation] Failed to send organization invitation:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
  return personnel;
}

export async function deletePersonnel(id: string) {
  await requireTenantInfo();

  await prisma.profiles.delete({
    where: { id },
  });

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
}
