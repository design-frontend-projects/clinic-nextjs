"use server";

import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { ProfileFormData, ClinicFormData, BranchFormData, SubscriptionFormData } from "@/types/onboarding.types";
import { profileSchema, clinicSchema, branchSchema, subscriptionSchema } from "@/types/onboarding.types";
import { cookies } from "next/headers";

export async function getOnboardingProgress() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const authId = session.user.id;

  const profile = await prisma.profiles.findUnique({
    where: { auth_user_id: authId },
  });

  if (!profile) {
    return { step: "profile" as const, data: {} };
  }

  const clinic = await prisma.clinics.findFirst({
    where: { auth_user_id: authId, is_primary: true },
  });

  if (!clinic) {
    return {
      step: "clinic" as const,
      data: {
        profileData: {
          full_name: profile.full_name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          role: profile.role || "owner",
          specialty: profile.specialty || "",
        },
      },
    };
  }

  const branch = await prisma.branches.findFirst({
    where: { clinic_id: clinic.id },
  });

  if (clinic.onboarding_completed_at && profile.is_profile_completed) {
    return { step: "completed" as const, clinicId: clinic.id };
  }

  return {
    step: "branch" as const,
    data: {
      profileData: {
        full_name: profile.full_name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        role: profile.role || "owner",
        specialty: profile.specialty || "",
      },
      clinicData: {
        name: clinic.name,
        registration_number: clinic.registration_number || "",
        email: clinic.email || "",
        phone: clinic.phone || "",
        subscription_plan: clinic.subscription_plan || "free",
        is_primary: clinic.is_primary ?? true,
      },
      branchData: branch
        ? {
            name: branch.name,
            address: branch.address || "",
            phone: branch.phone || "",
          }
        : {},
      clinicId: clinic.id,
    },
  };
}

export async function saveProfileStep(data: ProfileFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid data" };

    const profile = await prisma.profiles.upsert({
      where: { auth_user_id: session.user.id },
      update: {
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        role: "owner",
        specialty: parsed.data.specialty || null,
      },
      create: {
        auth_user_id: session.user.id,
        full_name: parsed.data.full_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        role: "owner",
        specialty: parsed.data.specialty || null,
        is_profile_completed: false,
        status: "active",
      },
    });

    return { success: true, profileId: profile.id };
  } catch (error) {
    console.error("Error saving profile:", error);
    return { error: "Failed to save profile" };
  }
}

export async function saveClinicStep(data: ClinicFormData, subscriptionData: SubscriptionFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const parsed = clinicSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid clinic data" };

    const subParsed = subscriptionSchema.safeParse(subscriptionData);
    if (!subParsed.success) return { error: subParsed.error.issues[0]?.message || "Invalid subscription data" };

    const planIdString = subParsed.data.plan_id;

    // Find if primary clinic already exists
    let clinic = await prisma.clinics.findFirst({
      where: { auth_user_id: session.user.id, is_primary: true },
    });

    if (clinic) {
      clinic = await prisma.clinics.update({
        where: { id: clinic.id },
        data: {
          name: parsed.data.name,
          registration_number: parsed.data.registration_number || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          subscription_plan: parsed.data.subscription_plan || "free",
        },
      });
    } else {
      clinic = await prisma.clinics.create({
        data: {
          auth_user_id: session.user.id,
          is_primary: true,
          name: parsed.data.name,
          registration_number: parsed.data.registration_number || null,
          email: parsed.data.email || null,
          phone: parsed.data.phone || null,
          subscription_plan: parsed.data.subscription_plan || "free",
          status: "active",
        },
      });
    }

    // Link the profile to this clinic
    await prisma.profiles.update({
      where: { auth_user_id: session.user.id },
      data: {
        tenant_id: clinic.id,
        clinic_id: clinic.id,
      },
    });

    // Ensure the subscription plan exists (mock data for now)
    const existingPlan = await prisma.subscription_plans.findFirst({
      where: { name: planIdString === "basic" ? "Basic" : "Pro" },
    });

    let planId = existingPlan?.id;

    if (!planId) {
      const newPlan = await prisma.subscription_plans.create({
        data: {
          name: planIdString === "basic" ? "Basic" : "Pro",
          billing_period: "monthly",
          price: planIdString === "basic" ? 29 : 99,
          currency: "USD",
        },
      });
      planId = newPlan.id;
    }

    // Create or update tenant subscription
    const startDate = new Date();
    // Add 1 month using vanilla JS date
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 1);

    await prisma.tenant_subscriptions.upsert({
      where: { tenant_id: clinic.id },
      update: {
        plan_id: planId,
        start_date: startDate,
        end_date: endDate,
        renewal_date: endDate,
        status: "active",
        billing_cycle: "monthly",
        price: planIdString === "basic" ? 29 : 99,
      },
      create: {
        tenant_id: clinic.id,
        plan_id: planId,
        start_date: startDate,
        end_date: endDate,
        renewal_date: endDate,
        status: "active",
        billing_cycle: "monthly",
        price: planIdString === "basic" ? 29 : 99,
      },
    });

    return { success: true, clinicId: clinic.id };
  } catch (error) {
    console.error("Error saving clinic:", error);
    return { error: "Failed to save clinic" };
  }
}

export async function saveBranchStep(data: BranchFormData, clinicId: string) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const parsed = branchSchema.safeParse(data);
    if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid data" };

    // Transaction to ensure branch creation, profile completion, and clinic onboarding mark succeed together
    await prisma.$transaction(async (tx) => {
      let branch = await tx.branches.findFirst({
        where: { clinic_id: clinicId, name: parsed.data.name },
      });

      if (branch) {
        branch = await tx.branches.update({
          where: { id: branch.id },
          data: {
            address: parsed.data.address || null,
            phone: parsed.data.phone || null,
          },
        });
      } else {
        branch = await tx.branches.create({
          data: {
            clinic_id: clinicId,
            name: parsed.data.name,
            address: parsed.data.address || null,
            phone: parsed.data.phone || null,
            status: "active",
          },
        });
      }

      await tx.clinics.update({
        where: { id: clinicId },
        data: { onboarding_completed_at: new Date() },
      });

      await tx.profiles.update({
        where: { auth_user_id: session.user.id },
        data: { is_profile_completed: true },
      });
    });

    // Set cookie for middleware
    const cookieStore = await cookies();
    cookieStore.set("onboarding_complete", "1", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    return { success: true };
  } catch (error) {
    console.error("Error saving branch:", error);
    return { error: "Failed to save branch" };
  }
}
