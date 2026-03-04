"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileFormData, ClinicFormData } from "@/types/onboarding.types";
import { profileSchema, clinicSchema } from "@/types/onboarding.types";

// ─── Create Clinic ──────────────────────────────────────────────
export async function createClinic(data: ClinicFormData) {
  try {
    const userAuth = await auth();
    if (!userAuth.userId) {
      return { error: "Unauthorized" };
    }

    const parsed = clinicSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid clinic data",
      };
    }

    const supabase = createSupabaseServerClient();

    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: parsed.data.name,
        registration_number: parsed.data.registration_number || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        subscription_plan: parsed.data.subscription_plan || null,
        status: "trial",
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
    const userAuth = await auth();
    const clerkId = userAuth.userId;

    if (!clerkId) {
      return { error: "Unauthorized" };
    }

    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid profile data",
      };
    }

    const supabase = createSupabaseServerClient();

    // Idempotency: check if profile already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", clerkId)
      .single();

    if (existingProfile) {
      return { success: true, profileId: existingProfile.id as string };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .insert({
        clerk_user_id: clerkId,
        clinic_id: data.clinicId,
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
  const currUser = await currentUser();
  const primaryEmail = currUser?.emailAddresses[0]?.emailAddress ?? "";
  const fullName =
    [currUser?.firstName, currUser?.lastName].filter(Boolean).join(" ") ||
    "Admin User";

  const clinicRes = await createClinic({
    name: clinicName || `${currUser?.firstName || "My"}'s Clinic`,
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
