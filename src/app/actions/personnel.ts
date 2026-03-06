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

  if (isNewRecord) {
    // ── Step 1: Invite user via Clerk ──
    if (!validatedData.email) {
      throw new Error("Email is required to invite a new user");
    }

    const client = await clerkClient();
    const invitation = await client.organizations.createOrganizationInvitation({
      emailAddress: validatedData.email,
      role: "org:doctor",
      organizationId: tenant.orgId as string,
      publicMetadata: {
        profileId: validatedData.id,
        internalRole: validatedData.role || "doctor",
      },
    });

    if (!invitation.id) {
      throw new Error("Failed to send Clerk invitation");
    }

    // ── Step 2: Insert new profile into Supabase ──
    const personnel = await prisma.profiles.create({
      data: {
        clerk_user_id: invitation.id,
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: validatedData.role || "doctor",
        specialty: validatedData.specialty ?? null,
        status:
          (validatedData.status as "active" | "inactive" | "blocked") ||
          "active",
        is_profile_completed: true,
      },
    });

    // ── Step 3: Send org invitation if org exists ──
    if (tenant.orgId) {
      try {
        await client.organizations.createOrganizationInvitation({
          organizationId: tenant.orgId,
          inviterUserId: tenant.userId,
          emailAddress: validatedData.email,
          role: "org:doctor",
          publicMetadata: {
            profileId: personnel.id,
            internalRole: validatedData.role || "doctor",
          },
        });
      } catch (error) {
        console.error(
          "[Clerk Invitation] Failed to send organization invitation:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    revalidatePath("/admin/doctors");
    revalidatePath("/admin/staff");
    return personnel;
  } else {
    // ── Update existing profile in Supabase ──
    const personnel = await prisma.profiles.update({
      where: { id: validatedData.id },
      data: {
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: validatedData.role,
        specialty: validatedData.specialty ?? null,
        status: validatedData.status as "active" | "inactive" | "blocked",
      },
    });

    revalidatePath("/admin/doctors");
    revalidatePath("/admin/staff");
    return personnel;
  }
}

export async function deletePersonnel(id: string) {
  await requireTenantInfo();

  await prisma.profiles.delete({
    where: { id },
  });

  revalidatePath("/admin/doctors");
  revalidatePath("/admin/staff");
}
