"use server";

import { getSupabaseSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type {
  ProfileFormData,
  ClinicFormData,
  BranchFormData,
  OnboardingBranchItem,
  SubscriptionFormData,
} from "@/types/onboarding.types";
import {
  profileSchema,
  clinicSchema,
  onboardingBranchesSchema,
  subscriptionSchema,
} from "@/types/onboarding.types";
import { syncDoctorSpecialties } from "@/lib/doctor-specialties";
import {
  canRunClinicOnboarding,
  extractActiveRbacRoleNames,
  resolveEffectiveProfileRole,
} from "@/lib/role-resolution";
import { roleHomePath } from "@/lib/role-routes";
import { fetchTenantAccountSnapshot } from "@/lib/tenant-subscription-snapshot";
import { cookies } from "next/headers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ONBOARDING_FORBIDDEN_ERROR =
  "Onboarding is only available for clinic owners.";

async function getOnboardingActor(authId: string) {
  const profile = await prisma.profiles.findUnique({
    where: { auth_user_id: authId },
    include: {
      user_roles: {
        where: { is_active: true, deleted_at: null },
        select: {
          roles: {
            select: {
              name: true,
              is_active: true,
              deleted_at: true,
            },
          },
        },
      },
    },
  });

  if (!profile) {
    return { profile: null, effectiveRole: "" };
  }

  const effectiveRole = resolveEffectiveProfileRole(
    profile.role,
    extractActiveRbacRoleNames(profile.user_roles),
  );

  return { profile, effectiveRole };
}

export async function getOnboardingProgress() {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const authId = session.user.id;

  const { profile, effectiveRole } = await getOnboardingActor(authId);

  if (!profile) {
    return { step: "profile" as const, data: {} };
  }

  if (!canRunClinicOnboarding(effectiveRole)) {
    return {
      step: "completed" as const,
      redirectPath: roleHomePath(effectiveRole),
    };
  }

  const [ownerBranches, clinic] = await Promise.all([
    prisma.branches.findMany({
      where: { owner_id: authId },
      orderBy: { created_at: "asc" },
    }),
    prisma.clinics.findFirst({
      where: { auth_user_id: authId, is_primary: true },
      include: {
        clinic_branches: {
          orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
        },
      },
    }),
  ]);

  if (clinic?.onboarding_completed_at && profile.is_profile_completed) {
    return {
      step: "completed" as const,
      clinicId: clinic.id,
      redirectPath: "/admin",
    };
  }

  const mappedBranches: OnboardingBranchItem[] = ownerBranches.map((b) => ({
    id: b.id,
    name: b.name,
    address: b.address || "",
    phone: b.phone || "",
  }));

  const profileData = {
    full_name: profile.full_name || "",
    email: profile.email || "",
    phone: profile.phone || "",
    role: profile.role || "owner",
    specialty: profile.specialty || "",
  };

  if (!clinic) {
    // New onboarding order: subscription → branch → clinic → specialties.
    // If owner already defined branches, resume at clinic; otherwise start at subscription.
    return {
      step: mappedBranches.length > 0 ? ("clinic" as const) : ("subscription" as const),
      data: {
        profileData,
        branches: mappedBranches,
      },
    };
  }

  const specialtyLinks = await prisma.doctor_specialties.findMany({
    where: { profile_id: profile.id },
    select: { specialty_id: true },
  });

  const linkedBranchIds = clinic.clinic_branches.map((cb) => cb.branch_id);
  const primaryBranchId =
    clinic.clinic_branches.find((cb) => cb.is_primary)?.branch_id ??
    linkedBranchIds[0];

  // Clinic exists (with linked branches) but onboarding is incomplete — resume at specialties.
  return {
    step: "specialties" as const,
    data: {
      profileData,
      branches: mappedBranches,
      clinicData: {
        name: clinic.name,
        registration_number: clinic.registration_number || "",
        email: clinic.email || "",
        phone: clinic.phone || "",
        subscription_plan: clinic.subscription_plan || "free",
        specialty_id: clinic.specialty_id || undefined,
        is_primary: clinic.is_primary ?? true,
        branch_ids: linkedBranchIds,
        primary_branch_id: primaryBranchId,
      },
      specialtyIds: specialtyLinks.map((s) => s.specialty_id),
      clinicId: clinic.id,
    },
  };
}

export async function saveProfileStep(data: ProfileFormData) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };

    const { profile: existingProfile, effectiveRole } = await getOnboardingActor(
      session.user.id,
    );
    if (existingProfile && !canRunClinicOnboarding(effectiveRole)) {
      return { error: ONBOARDING_FORBIDDEN_ERROR };
    }

    const parsed = profileSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid data" };
    }

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

/**
 * Step 2 of Onboarding: Define one or more owner-level physical branches.
 * Skipping (passing an empty array) creates a default "Main Branch" so the
 * Clinic step dropdown is never empty.
 */
export async function saveOnboardingBranchesStep(
  branchesInput: BranchFormData[],
): Promise<
  { success: true; branches: OnboardingBranchItem[] } | { error: string }
> {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const authId = session.user.id;

    const { profile, effectiveRole } = await getOnboardingActor(authId);
    if (profile && !canRunClinicOnboarding(effectiveRole)) {
      return { error: ONBOARDING_FORBIDDEN_ERROR };
    }

    const normalizedInput: BranchFormData[] =
      branchesInput.length > 0
        ? branchesInput
        : [{ name: "Main Branch", address: "", phone: "" }];

    const parsed = onboardingBranchesSchema.safeParse(normalizedInput);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid branch data",
      };
    }

    // Reject duplicate names (case-insensitive) within the submitted list.
    const seenNames = new Set<string>();
    for (const item of parsed.data) {
      const key = item.name.trim().toLowerCase();
      if (seenNames.has(key)) {
        return { error: `Duplicate branch name: "${item.name.trim()}"` };
      }
      seenNames.add(key);
    }

    const savedBranches = await prisma.$transaction(async (tx) => {
      const existing = await tx.branches.findMany({
        where: { owner_id: authId },
        include: { _count: { select: { clinic_branches: true } } },
        orderBy: { created_at: "asc" },
      });

      const existingById = new Map(existing.map((b) => [b.id, b]));
      const existingByLowerName = new Map(
        existing.map((b) => [b.name.trim().toLowerCase(), b]),
      );

      const keptIds = new Set<string>();
      const results: OnboardingBranchItem[] = [];

      for (const item of parsed.data) {
        const trimmedName = item.name.trim();
        const lowerName = trimmedName.toLowerCase();

        const match =
          (item.id ? existingById.get(item.id) : undefined) ??
          existingByLowerName.get(lowerName);

        if (match) {
          const updated = await tx.branches.update({
            where: { id: match.id },
            data: {
              name: trimmedName,
              address: item.address?.trim() || null,
              phone: item.phone?.trim() || null,
              status: "active",
            },
          });
          keptIds.add(updated.id);
          results.push({
            id: updated.id,
            name: updated.name,
            address: updated.address || "",
            phone: updated.phone || "",
          });
        } else {
          const created = await tx.branches.create({
            data: {
              id: crypto.randomUUID(),
              owner_id: authId,
              clinic_id: null,
              name: trimmedName,
              address: item.address?.trim() || null,
              phone: item.phone?.trim() || null,
              status: "active",
            },
          });
          keptIds.add(created.id);
          results.push({
            id: created.id,
            name: created.name,
            address: created.address || "",
            phone: created.phone || "",
          });
        }
      }

      // Clean up unlinked draft branches the owner removed while stepping back.
      const removableIds = existing
        .filter((b) => !keptIds.has(b.id) && b._count.clinic_branches === 0)
        .map((b) => b.id);

      if (removableIds.length > 0) {
        await tx.branches.deleteMany({
          where: { id: { in: removableIds }, owner_id: authId },
        });
      }

      return results;
    });

    return { success: true, branches: savedBranches };
  } catch (error) {
    console.error("Error saving onboarding branches:", error);
    return { error: "Failed to save branches" };
  }
}

/**
 * Step 3 of Onboarding: Define the primary clinic, link the selected owner
 * branches from the dropdown, and provision the chosen subscription plan.
 */
export async function saveClinicStep(
  data: ClinicFormData,
  subscriptionData: SubscriptionFormData,
) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const authId = session.user.id;

    const { profile, effectiveRole } = await getOnboardingActor(authId);
    if (profile && !canRunClinicOnboarding(effectiveRole)) {
      return { error: ONBOARDING_FORBIDDEN_ERROR };
    }

    const parsed = clinicSchema.safeParse(data);
    if (!parsed.success) {
      return {
        error: parsed.error.issues[0]?.message || "Invalid clinic data",
      };
    }

    const subParsed = subscriptionSchema.safeParse(subscriptionData);
    if (!subParsed.success) {
      return {
        error:
          subParsed.error.issues[0]?.message || "Invalid subscription data",
      };
    }

    const uniqueBranchIds = Array.from(new Set(parsed.data.branch_ids));

    // Ensure every selected branch belongs to this owner.
    const ownedBranches = await prisma.branches.findMany({
      where: {
        id: { in: uniqueBranchIds },
        owner_id: authId,
      },
      select: { id: true },
    });

    if (ownedBranches.length !== uniqueBranchIds.length) {
      return {
        error: "One or more selected branches are invalid. Please re-select.",
      };
    }

    const primaryBranchId =
      parsed.data.primary_branch_id &&
      uniqueBranchIds.includes(parsed.data.primary_branch_id)
        ? parsed.data.primary_branch_id
        : uniqueBranchIds[0];

    const planIdString = subParsed.data.plan_id;

    // Create/update primary clinic, link profile, and sync clinic_branches atomically.
    const clinic = await prisma.$transaction(async (tx) => {
      let existing = await tx.clinics.findFirst({
        where: { auth_user_id: authId, is_primary: true },
      });

      if (existing) {
        existing = await tx.clinics.update({
          where: { id: existing.id },
          data: {
            name: parsed.data.name,
            registration_number: parsed.data.registration_number || null,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            specialty_id: parsed.data.specialty_id || null,
            subscription_plan: parsed.data.subscription_plan || "free",
          },
        });
      } else {
        existing = await tx.clinics.create({
          data: {
            auth_user_id: authId,
            is_primary: true,
            name: parsed.data.name,
            registration_number: parsed.data.registration_number || null,
            email: parsed.data.email || null,
            phone: parsed.data.phone || null,
            specialty_id: parsed.data.specialty_id || null,
            subscription_plan: parsed.data.subscription_plan || "free",
            status: "active",
          },
        });
      }

      // Sync clinic_branches for this clinic.
      await tx.clinic_branches.deleteMany({
        where: {
          clinic_id: existing.id,
          branch_id: { notIn: uniqueBranchIds },
        },
      });

      await tx.clinic_branches.updateMany({
        where: { clinic_id: existing.id, is_primary: true },
        data: { is_primary: false },
      });

      for (const branchId of uniqueBranchIds) {
        await tx.clinic_branches.upsert({
          where: {
            clinic_id_branch_id: {
              clinic_id: existing.id,
              branch_id: branchId,
            },
          },
          create: {
            clinic_id: existing.id,
            branch_id: branchId,
            is_primary: branchId === primaryBranchId,
          },
          update: {
            is_primary: branchId === primaryBranchId,
          },
        });
      }

      // Link the owner profile to this clinic.
      await tx.profiles.update({
        where: { auth_user_id: authId },
        data: {
          tenant_id: existing.id,
          clinic_id: existing.id,
        },
      });

      return existing;
    });

    // Resolve the selected plan: a uuid means a real subscription_plans row
    // chosen on the public pricing page / onboarding picker; the legacy
    // "basic"/"pro" ids fall back to the mock create-if-missing behavior.
    let plan = UUID_RE.test(planIdString)
      ? await prisma.subscription_plans.findFirst({
          where: { id: planIdString, status: "active", deleted_at: null },
        })
      : null;

    if (!plan) {
      const legacyName = planIdString === "pro" ? "Pro" : "Basic";
      plan = await prisma.subscription_plans.findFirst({
        where: { name: legacyName },
      });
      if (!plan) {
        plan = await prisma.subscription_plans.create({
          data: {
            name: legacyName,
            billing_period: "monthly",
            price: legacyName === "Basic" ? 29 : 99,
            currency: "USD",
          },
        });
      }
    }

    const MONTHS_BY_PERIOD: Record<string, number | null> = {
      monthly: 1,
      quarterly: 3,
      semi_annual: 6,
      annual: 12,
      lifetime: null,
    };
    const startDate = new Date();
    const months = MONTHS_BY_PERIOD[plan.billing_period] ?? 1;
    let endDate: Date | null = null;
    if (months !== null) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
    }

    await prisma.tenant_subscriptions.upsert({
      where: { tenant_id: authId },
      update: {
        plan_id: plan.id,
        start_date: startDate,
        end_date: endDate,
        renewal_date: endDate,
        status: "active",
        billing_cycle: plan.billing_period,
        price: plan.price,
      },
      create: {
        tenant_id: authId,
        plan_id: plan.id,
        start_date: startDate,
        end_date: endDate,
        renewal_date: endDate,
        status: "active",
        billing_cycle: plan.billing_period,
        price: plan.price,
      },
    });

    const planName = plan.name.toLowerCase();
    const tier =
      Number(plan.price) === 0
        ? "free"
        : planName.includes("enterprise")
          ? "enterprise"
          : "pro";
    await prisma.clinics.update({
      where: { id: clinic.id },
      data: { subscription_plan: tier },
    });

    const snapshot = await fetchTenantAccountSnapshot(prisma, authId);

    // Set the owner's active branch cookie to the clinic's primary branch.
    const cookieStore = await cookies();
    cookieStore.set("active_branch_id", primaryBranchId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    return {
      success: true,
      clinicId: clinic.id,
      subscription: snapshot.subscription,
      profile: snapshot.profile,
    };
  } catch (error) {
    console.error("Error saving clinic:", error);
    return { error: "Failed to save clinic" };
  }
}

/**
 * Step 4 (Final) of Onboarding: Save specialties and complete onboarding.
 */
export async function saveSpecialtiesStep(specialtyIds: string[]) {
  try {
    const session = await getSupabaseSession();
    if (!session?.user?.id) return { error: "Unauthorized" };
    const authId = session.user.id;

    const { profile, effectiveRole } = await getOnboardingActor(authId);
    if (!profile) return { error: "Profile not found" };
    if (!canRunClinicOnboarding(effectiveRole)) {
      return { error: ONBOARDING_FORBIDDEN_ERROR };
    }

    const clinic = await prisma.clinics.findFirst({
      where: { auth_user_id: authId, is_primary: true },
      include: {
        clinic_branches: {
          orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
          take: 1,
        },
      },
    });
    if (!clinic) return { error: "Clinic not found. Please complete clinic setup first." };

    const valid =
      specialtyIds.length > 0
        ? await prisma.specialties.findMany({
            where: { id: { in: specialtyIds }, is_active: true },
            select: { id: true },
          })
        : [];
    const validIds = valid.map((s) => s.id);

    await prisma.$transaction(async (tx) => {
      await syncDoctorSpecialties(tx, profile.id, validIds);

      await tx.clinics.update({
        where: { id: clinic.id },
        data: { onboarding_completed_at: new Date() },
      });

      await tx.profiles.update({
        where: { auth_user_id: authId },
        data: { is_profile_completed: true },
      });
    });

    const cookieStore = await cookies();
    const { isSecureCookieContext } = await import("@/lib/cookie-options");
    const secure = await isSecureCookieContext();
    cookieStore.set("onboarding_complete", "1", {
      httpOnly: true,
      secure,
      path: "/",
      sameSite: "lax",
    });

    const primaryBranchId = clinic.clinic_branches[0]?.branch_id;
    if (primaryBranchId) {
      cookieStore.set("active_branch_id", primaryBranchId, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }

    return { success: true, specialtyIds: validIds };
  } catch (error) {
    console.error("Error saving specialties:", error);
    return { error: "Failed to save specialties" };
  }
}
