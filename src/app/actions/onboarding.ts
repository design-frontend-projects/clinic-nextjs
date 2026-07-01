"use server";

import { getSupabaseSession } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileFormData, ClinicFormData } from "@/types/onboarding.types";
import { profileSchema, clinicSchema } from "@/types/onboarding.types";

// ─── Create Clinic ──────────────────────────────────────────────
export async function createClinic(data: ClinicFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const parsed = clinicSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid clinic data",
      };
    }

    const supabase = createSupabaseServerClient();
    const { data: existingClinic } = await supabase
      .from("clinics")
      .select("id")
      .eq("auth_user_id", session.user.id)
      .eq("is_primary", true)
      .single();

    if (existingClinic) {
      return { error: "You already have a primary clinic" };
    }

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: parsed.data.name,
        registration_number: parsed.data.registration_number || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        subscription_plan: parsed.data.subscription_plan || null,
        status: "active",
        is_primary: existingClinic ? false : true,
        auth_user_id: session.user.id,
      })
      .select("id")
      .single();

    if (clinicError || !clinic) {
      console.error("Failed to create clinic:", clinicError);
      return { error: "Failed to create clinic" };
    }

    return { success: true, clinicId: clinic.id as string };
  } catch (error) {
    console.error("Error creating clinic:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ─── Create Profile ─────────────────────────────────────────────
export async function createProfile(
  data: ProfileFormData & { clinicId: string },
) {
  try {
    const session = await getSupabaseSession();
    const authId = session?.user.id;

    if (!authId) {
      return { error: "Unauthorized" };
    }

    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid profile data",
      };
    }

    const supabase = createSupabaseServerClient();

    // Idempotency: if profile already exists, update it with clinic link
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_user_id", authId)
      .single();

    if (existingProfile) {
      // Update the existing profile with onboarding data
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          org_id: data.clinicId, // clinicId matches org_id in profiles
          full_name: parsed.data.full_name,
          email: parsed.data.email,
          phone: parsed.data.phone || null,
          role: parsed.data.role || "admin",
          specialty: parsed.data.specialty || null,
          status: "active",
        })
        .eq("id", existingProfile.id);

      if (updateError) {
        console.error("Failed to update existing profile:", updateError);
        return { error: "Failed to update profile" };
      }

      return { success: true, profileId: existingProfile.id as string };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        auth_user_id: authId,
        org_id: data.clinicId,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        role: parsed.data.role || "admin",
        specialty: parsed.data.specialty || null,
        status: "active",
      })
      .select("id")
      .single();

    if (profileError || !profile) {
      console.error("Failed to create profile:", profileError);
      // Rollback: delete the clinic we just created
      await supabase.from("clinics").delete().eq("id", data.clinicId);
      return { error: "Failed to create profile" };
    }

    return { success: true, profileId: profile.id as string };
  } catch (error) {
    console.error("Error creating profile:", error);
    return { error: "An unexpected error occurred" };
  }
}

// ─── Complete Onboarding (Legacy compat — redirects to new flow) ─
export async function completeOnboarding(clinicName: string) {
  const session = await getSupabaseSession();
  const currUser = session?.user;
  const primaryEmail = currUser?.email ?? "";
  const fullName = currUser?.user_metadata?.full_name || "Admin User";

  const clinicRes = await createClinic({
    name: clinicName || `${fullName}'s Clinic`,
    email: primaryEmail,
  });

  if (clinicRes.error || !clinicRes.clinicId) {
    return { error: clinicRes.error || "Failed to create clinic" };
  }

  const profileRes = await createProfile({
    full_name: fullName,
    email: primaryEmail,
    role: "admin",
    clinicId: clinicRes.clinicId,
  });

  if (profileRes.error) {
    return { error: profileRes.error };
  }

  return { success: true };
}

