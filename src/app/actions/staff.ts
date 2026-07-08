"use server";

import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createUserAccount, rollbackAuthUser } from "@/lib/invitations";
import { findClinicDuplicate, duplicateMessage } from "@/lib/user-creation";
import { staffInviteSchema, type StaffInviteFormData } from "@/types/staff.types";
import { revalidatePath } from "next/cache";

/**
 * NOTE: Legacy standalone staff-invite action; the live staff path is
 * `upsertPersonnel` in `personnel.ts`. Kept in sync with the new
 * create-user + duplicate-check flow but intentionally minimal (no RBAC role
 * picker) since no UI currently calls it.
 */

export async function inviteStaffMember(data: StaffInviteFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const parsed = staffInviteSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid data" };

    // Get current user's clinic to assign the staff member to
    const doctorProfile = await prisma.profiles.findUnique({
      where: { auth_user_id: session.user.id },
      select: { tenant_id: true },
    });

    const tenantId = doctorProfile?.tenant_id;
    if (!tenantId) {
      return { error: "You must complete onboarding and have a clinic first." };
    }

    // Block duplicates within the clinic (by email).
    const duplicate = await findClinicDuplicate({
      clinicId: tenantId,
      email: parsed.data.email,
    });
    if (duplicate) {
      return { error: duplicateMessage(duplicate) };
    }

    // Create the confirmed auth user with a temp password (Supabase admin).
    let account;
    try {
      account = await createUserAccount({
        email: parsed.data.email,
        metadata: {
          full_name: parsed.data.full_name,
          role: "staff",
          tenant_id: tenantId,
        },
      });
    } catch (inviteError) {
      const message =
        inviteError instanceof Error ? inviteError.message : "Failed to create user";
      return { error: message };
    }

    // 2. Upsert profile mapped to the tenant (trigger pre-creates the row)
    try {
      await prisma.profiles.upsert({
        where: { auth_user_id: account.user.id },
        update: {
          tenant_id: tenantId,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: "staff",
          specialty: parsed.data.specialty || null,
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
        create: {
          auth_user_id: account.user.id,
          tenant_id: tenantId,
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          role: "staff",
          specialty: parsed.data.specialty || null,
          status: "active",
          is_owner: false,
          is_profile_completed: false,
        },
      });
    } catch (profileError) {
      // Orphan prevention: delete the auth user if profile creation fails
      console.error("Profile creation failed, rolling back auth user:", profileError);
      await rollbackAuthUser(account.user.id);
      return { error: "Failed to create staff profile. Rolled back." };
    }

    revalidatePath("/admin/staff");
    return { success: true, tempPassword: account.tempPassword };
  } catch (error) {
    console.error("Error inviting staff:", error);
    return { error: "An unexpected error occurred" };
  }
}
