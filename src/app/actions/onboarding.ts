"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeOnboarding(clinicName: string) {
  try {
    const userAuth = await auth();
    const clerkId = userAuth.userId;

    if (!clerkId) {
      return { error: "Unauthorized" };
    }

    const currUser = await currentUser();
    if (!currUser) {
      return { error: "User not found" };
    }

    const primaryEmail = currUser.emailAddresses[0]?.emailAddress ?? null;
    const fullName =
      [currUser.firstName, currUser.lastName].filter(Boolean).join(" ") ||
      "Admin User";

    const supabase = createSupabaseServerClient();

    // 1. Check if the profile already exists (avoids duplicate creation if they refresh/retry)
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", clerkId)
      .single();

    if (existingProfile) {
      return { success: true };
    }

    // 2. Create the Clinic
    const { data: clinic, error: clinicError } = await supabase
      .from("clinics")
      .insert({
        name: clinicName || `${currUser.firstName || "My"}'s Clinic`,
        email: primaryEmail,
        status: "trial",
      })
      .select("id")
      .single();

    if (clinicError || !clinic) {
      console.error("Failed to create clinic:", clinicError);
      return { error: "Failed to initialize clinic" };
    }

    // 3. Create Profile as 'admin'
    const { error: profileError } = await supabase.from("profiles").insert({
      clerk_user_id: clerkId,
      clinic_id: clinic.id,
      full_name: fullName,
      email: primaryEmail,
      role: "admin",
    });

    if (profileError) {
      console.error("Failed to create profile:", profileError);
      // Rollback clinic creation
      await supabase.from("clinics").delete().eq("id", clinic.id);
      return { error: "Failed to initialize profile" };
    }

    return { success: true };
  } catch (error) {
    console.error("Error during onboarding:", error);
    return { error: "An unexpected error occurred" };
  }
}
