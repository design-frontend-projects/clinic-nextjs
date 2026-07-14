import { z } from "zod";

export const billingPeriodEnum = z.enum([
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
]);

export const planStatusEnum = z.enum(["active", "inactive", "archived"]);

export const subscriptionStatusEnum = z.enum([
  "active",
  "past_due",
  "suspended",
  "cancelled",
]);

/** A feature row attached to a plan. */
export const planFeatureSchema = z.object({
  feature_name: z.string().min(1, "Feature name is required"),
  is_enabled: z.boolean().default(true),
});

/** Optional integer limit (blank field → null). */
const optionalLimit = z
  .union([z.coerce.number().int().min(0), z.literal(""), z.null()])
  .transform((v) => (v === "" || v === null ? null : v))
  .optional();

/** Create/update payload for a subscription plan. */
export const subscriptionPlanSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Plan name is required"),
  description: z.string().optional().nullable(),
  billing_period: billingPeriodEnum,
  trial_days: z.coerce.number().int().min(0).default(14),
  price: z.coerce.number().min(0, "Price must be zero or more"),
  currency: z.string().min(1).default("USD"),
  max_users: optionalLimit,
  max_storage_mb: optionalLimit,
  max_branches: optionalLimit,
  max_doctors: optionalLimit,
  max_appointments: optionalLimit,
  max_patients: optionalLimit,
  api_limits: optionalLimit,
  status: planStatusEnum.default("active"),
  display_order: z.coerce.number().int().min(0).default(0),
  public_notes: z.string().optional().nullable(),
  internal_notes: z.string().optional().nullable(),
  features: z.array(planFeatureSchema).default([]),
});

export type SubscriptionPlanFormData = z.input<typeof subscriptionPlanSchema>;
export type SubscriptionPlanData = z.output<typeof subscriptionPlanSchema>;

/** Assign / change a tenant's subscription plan. */
export const tenantSubscriptionSchema = z.object({
  tenant_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  billing_cycle: billingPeriodEnum,
  price: z.coerce.number().min(0),
  currency: z.string().min(1).default("USD"),
  status: subscriptionStatusEnum.default("active"),
  discount: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type TenantSubscriptionData = z.infer<typeof tenantSubscriptionSchema>;

export const paymentStatusEnum = z.enum(["pending", "paid", "refunded"]);

/** Full upsert payload for the app-owner tenant-subscription action. */
export const tenantSubscriptionUpsertSchema = z.object({
  tenant_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: subscriptionStatusEnum.default("active"),
  start_date: z.string().min(1, "Start date is required"),
  end_date: z.string().optional().nullable(),
  price: z.coerce.number().min(0),
  discount: z.coerce.number().min(0).optional().nullable(),
  billing_cycle: billingPeriodEnum,
  payment_status: paymentStatusEnum.default("pending"),
  payment_reference: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export type TenantSubscriptionUpsertData = z.infer<
  typeof tenantSubscriptionUpsertSchema
>;

/** Publicly-exposed subscription plan (landing page / onboarding picker). */
export type PublicPlanFeature = {
  feature_name: string;
  is_enabled: boolean;
};

export type PublicPlan = {
  id: string;
  name: string;
  description: string | null;
  billing_period: z.infer<typeof billingPeriodEnum>;
  trial_days: number;
  price: number;
  currency: string;
  max_users: number | null;
  max_branches: number | null;
  max_doctors: number | null;
  public_notes: string | null;
  display_order: number;
  features: PublicPlanFeature[];
};
