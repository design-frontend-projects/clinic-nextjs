"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { profileSchema, type Profile } from "@/types/clinic.types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProfileRole } from "@prisma/client";

export async function getPersonnel(userId: string) {
  const tenant = await requireTenantInfo();

  return prisma.profiles.findMany({
    where: {
      tenant_id: tenant.clinicId,
    },
    orderBy: { created_at: "desc" },
  });
}

export async function upsertPersonnel(data: Profile) {
  const tenant = await requireTenantInfo();
  const validatedData = profileSchema.parse(data);

  const isNewRecord = !validatedData.id;

  if (isNewRecord) {
    if (!validatedData.email) {
      throw new Error("Email is required to invite a new user");
    }

    const supabaseAdmin = createSupabaseServerClient();
    
    // Invite user via Supabase Admin API
    const { data: authData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(validatedData.email, {
      data: {
        full_name: validatedData.full_name,
        role: validatedData.role || "doctor",
        tenant_id: tenant.clinicId,
      }
    });

    if (inviteError || !authData.user) {
      console.error("[Supabase Invitation] Failed to send invitation:", inviteError);
      throw new Error("Failed to send invitation");
    }

    // Insert new profile into Supabase
    let personnel;
    try {
      personnel = await prisma.profiles.create({
        data: {
          auth_user_id: authData.user.id,
          tenant_id: tenant.clinicId,
          full_name: validatedData.full_name,
          email: validatedData.email,
          phone: validatedData.phone ?? null,
          role: (validatedData.role || "doctor") as ProfileRole,
          specialty: validatedData.specialty ?? null,
          status:
            (validatedData.status as "active" | "inactive" | "blocked") ||
            "active",
          is_profile_completed: false, // They must complete onboarding/password
        },
      });
    } catch (profileError) {
      console.error("Profile creation failed, rolling back auth user:", profileError);
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      throw new Error("Failed to create staff profile. Rolled back.");
    }

    revalidatePath("/admin/doctors");
    revalidatePath("/admin/staff");
    return personnel;
  } else {
    // Update existing profile in database
    const personnel = await prisma.profiles.update({
      where: { id: validatedData.id },
      data: {
        full_name: validatedData.full_name,
        email: validatedData.email,
        phone: validatedData.phone ?? null,
        role: validatedData.role as ProfileRole,
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
