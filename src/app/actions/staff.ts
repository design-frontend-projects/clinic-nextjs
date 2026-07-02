"use server";

import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { staffInviteSchema, type StaffInviteFormData } from "@/types/staff.types";
import { revalidatePath } from "next/cache";

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

    const supabase = createSupabaseServerClient();

    // 1. Create auth user
    // We use the Supabase Admin API because creating a user with a specific password
    // or sending an invite link without them logging out requires service_role key.
    // NOTE: For true admin invites, you should use supabase.auth.admin.inviteUserByEmail
    // But since the service role client has admin capabilities, we can do it.
    
    // Check if user already exists
    // The admin API might fail if the user already exists, but that's handled in the catch block.
    const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
      parsed.data.email,
      {
        data: {
          full_name: parsed.data.full_name,
          role: "staff"
        }
      }
    );

    if (authError || !authData.user) {
      console.error("Auth creation failed:", authError);
      return { error: authError?.message || "Failed to create user in auth system" };
    }

    // 2. Create profile mapped to the tenant
    try {
      await prisma.$transaction(async (tx) => {
        await tx.profiles.create({
          data: {
            auth_user_id: authData.user.id,
            tenant_id: tenantId,
            full_name: parsed.data.full_name,
            email: parsed.data.email,
            role: "staff",
            specialty: parsed.data.specialty || null,
            status: "active",
            is_profile_completed: false,
          },
        });
      });
    } catch (profileError) {
      // Orphan prevention: delete the auth user if profile creation fails
      console.error("Profile creation failed, rolling back auth user:", profileError);
      await supabase.auth.admin.deleteUser(authData.user.id);
      return { error: "Failed to create staff profile. Rolled back." };
    }

    revalidatePath("/admin/staff");
    return { success: true };
  } catch (error) {
    console.error("Error inviting staff:", error);
    return { error: "An unexpected error occurred" };
  }
}
