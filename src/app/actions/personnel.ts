"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { profileSchema, type Profile } from "@/types/clinic.types";
import { clerkClient } from "@clerk/nextjs/server";

export async function getPersonnel(userId: string) {
  await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      clerk_user_id: userId,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function upsertPersonnel(data: Profile) {
  const tenant = await requireTenantInfo();
  const validatedData = profileSchema.parse(data);

  const isNewRecord = !validatedData.id;
  // create record with clerk server first and then update the clerk user id in the personnel table
  const clerkUser = await (
    await clerkClient()
  ).invitations.createInvitation({
    emailAddress: validatedData.email as string,
    notify: true,
    publicMetadata: {
      profileId: validatedData.id,
      internalRole: validatedData.role,
    },
  });

  if (clerkUser.id) {
    validatedData.clerk_user_id = clerkUser.id;
  } else {
    throw new Error("Failed to create clerk user");
  }

  const personnel = await prisma.profiles.upsert({
    where: { id: validatedData.id ?? "" },
    create: {
      clerk_user_id:
        validatedData.clerk_user_id || `temp-${crypto.randomUUID()}`,
      full_name: validatedData.full_name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: validatedData.role,
      specialty: validatedData.specialty,
      status: validatedData.status as "active" | "inactive" | "blocked",
    },
    update: {
      full_name: validatedData.full_name,
      email: validatedData.email,
      phone: validatedData.phone,
      role: validatedData.role,
      specialty: validatedData.specialty,
      status: validatedData.status as "active" | "inactive" | "blocked",
      clerk_user_id: validatedData.clerk_user_id,
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
