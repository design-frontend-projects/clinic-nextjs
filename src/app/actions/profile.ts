"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  getSupabaseSession,
  requireAuthenticatedTenant,
  requireTenantInfo,
} from "@/lib/auth";
import { isSecureCookieContext } from "@/lib/cookie-options";
import {
  maskEmailAddress,
  PENDING_PHONE_COOKIE_NAME,
  PENDING_PHONE_TTL_SECONDS,
  signPendingPhoneToken,
  splitFullName,
  verifyPendingPhoneToken,
} from "@/lib/phone-otp";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { duplicateMessage, findClinicDuplicate } from "@/lib/user-creation";
import {
  phoneChangeRequestSchema,
  phoneChangeVerifySchema,
  profileDetailsUpdateSchema,
  type PhoneChangeRequestInput,
  type PhoneChangeVerifyInput,
  type ProfileBranchSummary,
  type ProfileDetailsUpdateInput,
  type RequestPhoneChangeOtpResult,
  type UpdateProfileDetailsResult,
  type UserProfileView,
  type VerifyPhoneChangeOtpResult,
} from "@/types/profile.types";

const ONE_YEAR = 60 * 60 * 24 * 365;

async function createCookieBoundSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Ignored if called in a context where headers cannot be mutated.
        }
      },
    },
  });
}

async function writeProfileAuditLog(params: {
  clinicId: string | null;
  profileId: string;
  actorEmail: string | null;
  action: string;
  oldValues: Record<string, unknown>;
  newValues: Record<string, unknown>;
}) {
  if (!params.clinicId) return;
  try {
    await prisma.audit_logs.create({
      data: {
        tenant_id: params.clinicId,
        action: params.action,
        actor_id: params.profileId,
        actor_email: params.actorEmail,
        entity_type: "profiles",
        entity_id: params.profileId,
        old_values: params.oldValues as object,
        new_values: params.newValues as object,
      },
    });
  } catch {
    // Audit logging is best-effort and must not fail an already-committed profile update.
  }
}

export async function updateProfileBranch(branchId: string) {
  const tenant = await requireTenantInfo();

  if (tenant.role === "doctor") {
    // Doctors switch only among the branches they're assigned to within their
    // active clinic (validated against profile_branches).
    const assigned = await prisma.profile_branches.findFirst({
      where: {
        profile_id: tenant.profileId,
        branch_id: branchId,
        clinic_id: tenant.clinicId,
      },
      select: { id: true },
    });
    if (!assigned) {
      throw new Error("You are not assigned to this branch");
    }
  } else {
    // Other branch-locked roles cannot switch; their branch is admin-assigned.
    if (tenant.branchLocked) {
      throw new Error("Your branch is assigned by your clinic administrator");
    }
    // Owners/admins may switch to any branch linked to their clinic.
    const link = await prisma.clinic_branches.findFirst({
      where: { branch_id: branchId, clinic_id: tenant.clinicId },
      select: { id: true },
    });
    if (!link) {
      throw new Error("Invalid branch for this clinic");
    }
  }

  const cookieStore = await cookies();
  cookieStore.set("active_branch_id", branchId, {
    path: "/",
    maxAge: ONE_YEAR,
  });

  revalidatePath("/");
}

/**
 * Switch the doctor's active clinic. Validates the clinic is one they're
 * assigned to, sets the `active_clinic_id` cookie, and resets `active_branch_id`
 * to that clinic's primary (or first) assigned branch so the branch context is
 * never left pointing at a branch in the previous clinic.
 */
export async function setActiveClinic(clinicId: string) {
  const tenant = await requireTenantInfo();

  const assignment = await prisma.profile_branches.findFirst({
    where: { profile_id: tenant.profileId, clinic_id: clinicId },
    select: { branch_id: true },
    orderBy: { is_primary: "desc" },
  });
  if (!assignment) {
    throw new Error("You are not assigned to this clinic");
  }

  const cookieStore = await cookies();
  cookieStore.set("active_clinic_id", clinicId, {
    path: "/",
    maxAge: ONE_YEAR,
  });
  cookieStore.set("active_branch_id", assignment.branch_id, {
    path: "/",
    maxAge: ONE_YEAR,
  });

  revalidatePath("/");
}

export interface MyAssignments {
  clinics: { id: string; name: string }[];
  branches: {
    id: string;
    name: string;
    address: string | null;
    clinic_id: string;
  }[];
}

/**
 * The doctor's assigned clinics + branches, for the top-bar clinic/branch
 * switchers. Returns empty lists for non-doctors (or doctors without
 * assignments), so the header can fall back to the read-only display.
 */
export async function getMyAssignments(): Promise<MyAssignments> {
  const tenant = await requireTenantInfo();
  if (tenant.role !== "doctor") return { clinics: [], branches: [] };

  const rows = await prisma.profile_branches.findMany({
    where: { profile_id: tenant.profileId },
    select: {
      is_primary: true,
      clinics: { select: { id: true, name: true } },
      branches: { select: { id: true, name: true, address: true } },
    },
    orderBy: [{ is_primary: "desc" }],
  });

  const clinicMap = new Map<string, { id: string; name: string }>();
  const branches: MyAssignments["branches"] = [];
  for (const r of rows) {
    if (!clinicMap.has(r.clinics.id)) {
      clinicMap.set(r.clinics.id, { id: r.clinics.id, name: r.clinics.name });
    }
    branches.push({
      id: r.branches.id,
      name: r.branches.name,
      address: r.branches.address,
      clinic_id: r.clinics.id,
    });
  }

  return { clinics: [...clinicMap.values()], branches };
}

/**
 * Fetch the full profile view for the currently authenticated user across all
 * roles (including platform app_owners without a clinic).
 */
export async function getMyProfile(): Promise<UserProfileView | null> {
  const session = await getSupabaseSession();
  if (!session?.user?.id) return null;

  let tenant: Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
  try {
    tenant = await requireAuthenticatedTenant();
  } catch {
    return null;
  }

  const profile = await prisma.profiles.findUnique({
    where: { id: tenant.profileId },
    select: {
      id: true,
      full_name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      specialty: true,
      is_owner: true,
      created_at: true,
      branches: { select: { id: true, name: true } },
      profile_branches: {
        select: {
          is_primary: true,
          branches: { select: { id: true, name: true } },
          clinics: { select: { name: true } },
        },
        orderBy: [{ is_primary: "desc" }],
      },
    },
  });

  if (!profile) return null;

  const linkedPatient = tenant.clinicId
    ? await prisma.patients.findFirst({
        where: {
          profile_id: tenant.profileId,
          clinic_id: tenant.clinicId,
          deleted_at: null,
        },
        select: { id: true },
      })
    : null;

  const branches: ProfileBranchSummary[] = [];
  if (profile.profile_branches.length > 0) {
    for (const assignment of profile.profile_branches) {
      branches.push({
        id: assignment.branches.id,
        name: assignment.branches.name,
        clinic_name: assignment.clinics.name,
        is_primary: assignment.is_primary,
      });
    }
  } else if (tenant.branchId && tenant.branchName) {
    branches.push({
      id: tenant.branchId,
      name: tenant.branchName,
      clinic_name: tenant.clinicName,
      is_primary: true,
    });
  } else if (profile.branches) {
    branches.push({
      id: profile.branches.id,
      name: profile.branches.name,
      clinic_name: tenant.clinicName,
      is_primary: true,
    });
  }

  return {
    id: profile.id,
    full_name: profile.full_name ?? "",
    email: session.user.email ?? profile.email ?? "",
    phone: profile.phone ?? "",
    role: String(profile.role ?? tenant.role ?? "staff"),
    status: String(profile.status),
    specialty: profile.specialty,
    is_owner: profile.is_owner,
    created_at: profile.created_at.toISOString(),
    clinic:
      tenant.clinicId && tenant.clinicName
        ? { id: tenant.clinicId, name: tenant.clinicName }
        : null,
    branches,
    has_patient_record: Boolean(linkedPatient),
  };
}

/**
 * Update non-sensitive profile details (`full_name`) immediately without OTP.
 * Syncs linked patient records (if any), updates Supabase Auth user metadata,
 * and records an audit log entry.
 */
export async function updateMyProfileDetails(
  input: ProfileDetailsUpdateInput,
): Promise<UpdateProfileDetailsResult> {
  const parsed = profileDetailsUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid profile details",
      code: "validation_error",
    };
  }

  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to update your profile.",
      code: "unauthorized",
    };
  }

  let tenant: Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
  try {
    tenant = await requireAuthenticatedTenant();
  } catch {
    return {
      success: false,
      error: "You must be signed in to update your profile.",
      code: "unauthorized",
    };
  }

  const fullName = parsed.data.full_name;
  const currentProfile = await prisma.profiles.findUnique({
    where: { id: tenant.profileId },
    select: { full_name: true, email: true },
  });

  if (!currentProfile) {
    return {
      success: false,
      error: "Profile not found.",
      code: "unauthorized",
    };
  }

  const linkedPatient = tenant.clinicId
    ? await prisma.patients.findFirst({
        where: {
          profile_id: tenant.profileId,
          clinic_id: tenant.clinicId,
          deleted_at: null,
        },
        select: { id: true },
      })
    : null;

  await prisma.$transaction(async (tx) => {
    await tx.profiles.update({
      where: { id: tenant.profileId },
      data: { full_name: fullName },
    });

    if (linkedPatient) {
      const { first_name, last_name } = splitFullName(fullName);
      await tx.patients.update({
        where: { id: linkedPatient.id },
        data: { first_name, last_name },
      });
    }
  });

  // Sync Supabase Auth user_metadata.full_name (best-effort)
  try {
    const adminSupabase = createSupabaseServerClient();
    await adminSupabase.auth.admin.updateUserById(session.user.id, {
      user_metadata: {
        ...(session.user.user_metadata ?? {}),
        full_name: fullName,
      },
    });
  } catch {
    // Non-fatal: Postgres profile is the source of truth.
  }

  await writeProfileAuditLog({
    clinicId: tenant.clinicId,
    profileId: tenant.profileId,
    actorEmail: session.user.email ?? currentProfile.email ?? null,
    action: "profile.updated",
    oldValues: { full_name: currentProfile.full_name },
    newValues: { full_name: fullName },
  });

  revalidatePath("/profile");
  revalidatePath("/");

  return { success: true, full_name: fullName };
}

/**
 * Step 1 of phone change verification: validate phone format & clinic
 * uniqueness, ask Supabase Auth to send an email OTP to the logged-in user's
 * authoritative registered email, and bind the pending phone in a signed
 * HttpOnly cookie.
 */
export async function requestPhoneChangeOtp(
  input: PhoneChangeRequestInput,
): Promise<RequestPhoneChangeOtpResult> {
  const parsed = phoneChangeRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Please enter a valid phone number",
      code: "validation_error",
    };
  }

  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to update your phone number.",
      code: "unauthorized",
    };
  }

  const authEmail = session.user.email?.trim();
  if (!authEmail) {
    return {
      success: false,
      error: "No registered email address is associated with your account.",
      code: "no_email",
    };
  }

  let tenant: Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
  try {
    tenant = await requireAuthenticatedTenant();
  } catch {
    return {
      success: false,
      error: "You must be signed in to update your phone number.",
      code: "unauthorized",
    };
  }

  const newPhone = parsed.data.newPhone;
  const currentProfile = await prisma.profiles.findUnique({
    where: { id: tenant.profileId },
    select: { phone: true },
  });

  if (!currentProfile) {
    return {
      success: false,
      error: "Profile not found.",
      code: "unauthorized",
    };
  }

  if ((currentProfile.phone ?? "").trim() === newPhone) {
    return {
      success: false,
      error: "The new phone number matches your current phone number.",
      code: "same_phone",
    };
  }

  if (tenant.clinicId) {
    const linkedPatient = await prisma.patients.findFirst({
      where: {
        profile_id: tenant.profileId,
        clinic_id: tenant.clinicId,
        deleted_at: null,
      },
      select: { id: true },
    });

    const duplicate = await findClinicDuplicate({
      clinicId: tenant.clinicId,
      phone: newPhone,
      excludeProfileId: tenant.profileId,
      excludePatientId: linkedPatient?.id,
    });

    if (duplicate) {
      return {
        success: false,
        error: duplicateMessage(duplicate),
        code: "duplicate_phone",
      };
    }
  }

  const supabase = await createCookieBoundSupabaseClient();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: authEmail,
    options: {
      shouldCreateUser: false,
    },
  });

  if (otpError) {
    const isRateLimited =
      otpError.code === "over_email_send_rate_limit" || otpError.status === 429;
    return {
      success: false,
      error: otpError.message || "Failed to send verification code.",
      code: isRateLimited ? "rate_limited" : "otp_send_failed",
    };
  }

  const token = signPendingPhoneToken({
    uid: session.user.id,
    pid: tenant.profileId,
    phone: newPhone,
    exp: Date.now() + PENDING_PHONE_TTL_SECONDS * 1000,
  });

  const cookieStore = await cookies();
  const secure = await isSecureCookieContext();
  cookieStore.set(PENDING_PHONE_COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: PENDING_PHONE_TTL_SECONDS,
  });

  return {
    success: true,
    maskedEmail: maskEmailAddress(authEmail),
    expiresInSeconds: PENDING_PHONE_TTL_SECONDS,
  };
}

/**
 * Step 2 of phone change verification: validate the signed pending-phone cookie,
 * verify the OTP with Supabase Auth against the user's registered email,
 * re-check clinic phone uniqueness, and atomically commit the phone update.
 */
export async function verifyPhoneChangeOtp(
  input: PhoneChangeVerifyInput,
): Promise<VerifyPhoneChangeOtpResult> {
  const parsed = phoneChangeVerifySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid verification input",
      code: "validation_error",
    };
  }

  const session = await getSupabaseSession();
  if (!session?.user?.id) {
    return {
      success: false,
      error: "You must be signed in to verify your phone change.",
      code: "unauthorized",
    };
  }

  const authEmail = session.user.email?.trim();
  if (!authEmail) {
    return {
      success: false,
      error: "No registered email address is associated with your account.",
      code: "no_email",
    };
  }

  let tenant: Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
  try {
    tenant = await requireAuthenticatedTenant();
  } catch {
    return {
      success: false,
      error: "You must be signed in to verify your phone change.",
      code: "unauthorized",
    };
  }

  const { newPhone, otp } = parsed.data;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(PENDING_PHONE_COOKIE_NAME)?.value;

  if (!rawToken) {
    return {
      success: false,
      error: "Verification session expired. Please request a new code.",
      code: "otp_expired",
    };
  }

  const pendingCheck = verifyPendingPhoneToken(rawToken, {
    uid: session.user.id,
    pid: tenant.profileId,
    phone: newPhone,
  });

  if (!pendingCheck.valid) {
    if (pendingCheck.reason === "expired") {
      cookieStore.delete(PENDING_PHONE_COOKIE_NAME);
      return {
        success: false,
        error: "Verification session expired. Please request a new code.",
        code: "otp_expired",
      };
    }
    return {
      success: false,
      error: "Pending phone verification mismatch. Please request a new code.",
      code: "invalid_pending_request",
    };
  }

  const supabase = await createCookieBoundSupabaseClient();
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email: authEmail,
    token: otp,
    type: "email",
  });

  if (
    verifyError ||
    !verifyData.user ||
    verifyData.user.id !== session.user.id
  ) {
    const isExpired = verifyError?.code === "otp_expired";
    return {
      success: false,
      error:
        verifyError?.message ||
        "The verification code is invalid or has expired.",
      code: isExpired ? "otp_expired" : "invalid_otp",
    };
  }

  const currentProfile = await prisma.profiles.findUnique({
    where: { id: tenant.profileId },
    select: { phone: true },
  });

  const linkedPatient = tenant.clinicId
    ? await prisma.patients.findFirst({
        where: {
          profile_id: tenant.profileId,
          clinic_id: tenant.clinicId,
          deleted_at: null,
        },
        select: { id: true },
      })
    : null;

  if (tenant.clinicId) {
    const duplicate = await findClinicDuplicate({
      clinicId: tenant.clinicId,
      phone: newPhone,
      excludeProfileId: tenant.profileId,
      excludePatientId: linkedPatient?.id,
    });

    if (duplicate) {
      cookieStore.delete(PENDING_PHONE_COOKIE_NAME);
      return {
        success: false,
        error: duplicateMessage(duplicate),
        code: "duplicate_phone",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.profiles.update({
      where: { id: tenant.profileId },
      data: { phone: newPhone },
    });

    if (linkedPatient) {
      await tx.patients.update({
        where: { id: linkedPatient.id },
        data: { phone: newPhone },
      });
    }
  });

  await writeProfileAuditLog({
    clinicId: tenant.clinicId,
    profileId: tenant.profileId,
    actorEmail: authEmail,
    action: "profile.phone_updated",
    oldValues: { phone: currentProfile?.phone ?? null },
    newValues: { phone: newPhone, verified_via: "supabase_email_otp" },
  });

  cookieStore.delete(PENDING_PHONE_COOKIE_NAME);
  revalidatePath("/profile");
  revalidatePath("/");

  return { success: true, phone: newPhone };
}

/**
 * Clear the signed pending-phone cookie when the user cancels OTP verification.
 */
export async function cancelPhoneChangeOtp(): Promise<{ success: true }> {
  const cookieStore = await cookies();
  cookieStore.delete(PENDING_PHONE_COOKIE_NAME);
  return { success: true };
}
