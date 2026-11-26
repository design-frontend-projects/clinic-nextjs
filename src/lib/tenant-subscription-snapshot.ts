import type {
  TenantAccountSnapshot,
  TenantOwnerProfileRecord,
  TenantSubscriptionPlanSummary,
  TenantSubscriptionRecord,
} from "@/types/subscription.types";

export const TENANT_OWNER_PROFILE_SELECT = {
  id: true,
  auth_user_id: true,
  tenant_id: true,
  clinic_id: true,
  branch_id: true,
  full_name: true,
  email: true,
  phone: true,
  specialty: true,
  role: true,
  is_owner: true,
  status: true,
  is_profile_completed: true,
  created_at: true,
} as const;

export const TENANT_SUBSCRIPTION_INCLUDE = {
  plan: {
    select: {
      id: true,
      name: true,
      billing_period: true,
      price: true,
      currency: true,
    },
  },
} as const;

interface RawProfileRow {
  id: string;
  auth_user_id: string;
  tenant_id: string | null;
  clinic_id: string | null;
  branch_id: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  specialty: string | null;
  role: string | null;
  is_owner: boolean;
  status: string;
  is_profile_completed: boolean | null;
  created_at: Date | string;
}

interface RawPlanRow {
  id: string;
  name: string;
  billing_period: string;
  price: unknown;
  currency: string;
}

interface RawSubscriptionRow {
  id: string;
  tenant_id: string;
  plan_id: string;
  plan?: RawPlanRow | null;
  start_date: Date | string;
  end_date: Date | string | null;
  renewal_date: Date | string | null;
  activated_at: Date | string | null;
  grace_period_days: number;
  status: string;
  billing_cycle: string;
  price: unknown;
  discount: unknown;
  currency: string;
  payment_status: string;
  payment_reference: string | null;
  notes: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface TenantSnapshotDbClient {
  profiles: {
    findUnique: (args: {
      where: { auth_user_id: string };
      select: typeof TENANT_OWNER_PROFILE_SELECT;
    }) => Promise<RawProfileRow | null>;
  };
  tenant_subscriptions: {
    findUnique: (args: {
      where: { tenant_id: string };
      include: typeof TENANT_SUBSCRIPTION_INCLUDE;
    }) => Promise<RawSubscriptionRow | null>;
  };
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIsoString(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return toIsoString(value);
}

function serializePlanSummary(
  plan: RawPlanRow | null | undefined,
): TenantSubscriptionPlanSummary | null {
  if (!plan) return null;
  return {
    id: plan.id,
    name: plan.name,
    billing_period: String(plan.billing_period),
    price: Number(plan.price),
    currency: plan.currency,
  };
}

/**
 * Convert a Prisma `profiles` row into a JSON-serializable object safe to
 * return from Next.js Server Actions.
 */
export function serializeTenantProfile(
  row: RawProfileRow,
): TenantOwnerProfileRecord {
  return {
    id: row.id,
    auth_user_id: row.auth_user_id,
    tenant_id: row.tenant_id ?? null,
    clinic_id: row.clinic_id ?? null,
    branch_id: row.branch_id ?? null,
    full_name: row.full_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    specialty: row.specialty ?? null,
    role: row.role ? String(row.role) : null,
    is_owner: Boolean(row.is_owner),
    status: String(row.status),
    is_profile_completed: Boolean(row.is_profile_completed),
    created_at: toIsoString(row.created_at),
  };
}

/**
 * Convert a Prisma `tenant_subscriptions` row (converting `Decimal` and `Date`
 * values) into a JSON-serializable object safe to return from Server Actions.
 */
export function serializeTenantSubscription(
  row: RawSubscriptionRow,
): TenantSubscriptionRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    plan_id: row.plan_id,
    plan: serializePlanSummary(row.plan),
    start_date: toIsoString(row.start_date),
    end_date: toNullableIsoString(row.end_date),
    renewal_date: toNullableIsoString(row.renewal_date),
    activated_at: toNullableIsoString(row.activated_at),
    grace_period_days: Number(row.grace_period_days ?? 7),
    status: String(row.status),
    billing_cycle: String(row.billing_cycle),
    price: Number(row.price),
    discount:
      row.discount === null || row.discount === undefined
        ? null
        : Number(row.discount),
    currency: row.currency,
    payment_status: String(row.payment_status),
    payment_reference: row.payment_reference ?? null,
    notes: row.notes ?? null,
    created_at: toIsoString(row.created_at),
    updated_at: toIsoString(row.updated_at),
  };
}

/**
 * Fetch and serialize the owner `profiles` row and `tenant_subscriptions` row
 * strictly scoped to `ownerAuthUserId` (`auth.users.id` / `profiles.auth_user_id`).
 */
export async function fetchTenantAccountSnapshot(
  db: TenantSnapshotDbClient,
  ownerAuthUserId: string,
): Promise<TenantAccountSnapshot> {
  const [profileRow, subscriptionRow] = await Promise.all([
    db.profiles.findUnique({
      where: { auth_user_id: ownerAuthUserId },
      select: TENANT_OWNER_PROFILE_SELECT,
    }),
    db.tenant_subscriptions.findUnique({
      where: { tenant_id: ownerAuthUserId },
      include: TENANT_SUBSCRIPTION_INCLUDE,
    }),
  ]);

  if (!profileRow) {
    throw new Error(
      `Owner profile not found for auth_user_id ${ownerAuthUserId}`,
    );
  }

  return {
    subscription: subscriptionRow
      ? serializeTenantSubscription(subscriptionRow)
      : null,
    profile: serializeTenantProfile(profileRow),
  };
}

export interface OwnerLookupDbClient {
  profiles: {
    findUnique: (args: {
      where: { auth_user_id: string };
      select: { id: true; auth_user_id: true; role: true; is_owner: true };
    }) => Promise<{
      id: string;
      auth_user_id: string;
      role: string | null;
      is_owner: boolean;
    } | null>;
  };
  clinics: {
    findUnique: (args: {
      where: { id: string };
      select: {
        auth_user_id: true;
        staff_profiles: {
          where: { role: "owner" };
          select: { id: true; auth_user_id: true };
          take: 1;
        };
      };
    }) => Promise<{
      auth_user_id: string | null;
      staff_profiles: Array<{ id: string; auth_user_id: string }>;
    } | null>;
  };
}

/**
 * Resolve the tenant owner's `auth_user_id` from either an owner `auth_user_id`
 * directly or a legacy `clinics.id`. Returns `null` when no owner exists.
 */
export async function resolveTenantOwnerAuthId(
  db: OwnerLookupDbClient,
  tenantOrClinicId: string,
): Promise<{ ownerAuthUserId: string; ownerProfileId: string | null } | null> {
  const directOwner = await db.profiles.findUnique({
    where: { auth_user_id: tenantOrClinicId },
    select: { id: true, auth_user_id: true, role: true, is_owner: true },
  });

  if (directOwner && (directOwner.role === "owner" || directOwner.is_owner)) {
    return {
      ownerAuthUserId: directOwner.auth_user_id,
      ownerProfileId: directOwner.id,
    };
  }

  const clinic = await db.clinics.findUnique({
    where: { id: tenantOrClinicId },
    select: {
      auth_user_id: true,
      staff_profiles: {
        where: { role: "owner" },
        select: { id: true, auth_user_id: true },
        take: 1,
      },
    },
  });

  if (!clinic) return null;

  const ownerAuthUserId =
    clinic.auth_user_id ?? clinic.staff_profiles[0]?.auth_user_id ?? null;
  if (!ownerAuthUserId) return null;

  return {
    ownerAuthUserId,
    ownerProfileId: clinic.staff_profiles[0]?.id ?? null,
  };
}
