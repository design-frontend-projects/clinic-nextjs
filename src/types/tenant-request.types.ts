import { z } from "zod";
import {
  billingPeriodEnum,
  paymentStatusEnum,
  type TenantOwnerProfileRecord,
  type TenantSubscriptionRecord,
} from "@/types/subscription.types";
import type { TenantAccessDenied } from "@/lib/tenant-access";

/**
 * Public self-service tenant account request payload submitted on `/sign-up`.
 * The applicant supplies their chosen password upfront; the account stays
 * `under_review` until an `app_owner` approves it.
 */
export const tenantRequestSchema = z
  .object({
    fullName: z.string().trim().min(2, "Full name must be at least 2 characters"),
    email: z.string().trim().email("Please enter a valid email address"),
    phone: z.string().trim().min(6, "Phone number must be at least 6 characters"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Please confirm your password"),
    clinicName: z.string().trim().min(2, "Clinic name must be at least 2 characters"),
    registrationNumber: z.string().trim().optional().or(z.literal("")),
    clinicEmail: z
      .string()
      .trim()
      .email("Please enter a valid clinic email")
      .optional()
      .or(z.literal("")),
    clinicPhone: z.string().trim().optional().or(z.literal("")),
    planId: z.string().uuid("Please select a subscription plan"),
  })
  .refine((val) => val.password === val.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type TenantRequestFormData = z.input<typeof tenantRequestSchema>;
export type TenantRequestData = z.output<typeof tenantRequestSchema>;

export type RequestTenantAccountResult =
  | {
      success: true;
      requestRef: string;
      clinicName: string;
      email: string;
      subscription: TenantSubscriptionRecord;
      profile: TenantOwnerProfileRecord;
    }
  | { error: string };

/** Public status lookup payload for `/request-status`. */
export const checkRequestStatusSchema = z.object({
  requestRef: z.string().trim().min(3, "Reference number is required"),
  email: z.string().trim().email("Please enter a valid email address"),
});

export type CheckRequestStatusData = z.infer<typeof checkRequestStatusSchema>;

export type TenantRequestStatusDetails = {
  requestRef: string;
  clinicName: string;
  status: string;
  planName: string | null;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
  paymentStatus: string | null;
  startDate: string | null;
  endDate: string | null;
};

export type TenantRequestStatusResult =
  | { success: true; request: TenantRequestStatusDetails }
  | { error: string };

/** App-owner approval payload for an `under_review` / `rejected` tenant request. */
export const approveTenantRequestSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().uuid("Select a subscription plan"),
  clinicStatus: z.enum(["active", "trial"]).default("active"),
  billingCycle: billingPeriodEnum,
  price: z.coerce.number().min(0, "Price must be zero or more"),
  discount: z.coerce.number().min(0).optional().nullable(),
  currency: z.string().trim().min(1).default("USD"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().optional().nullable(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365).default(7),
  paymentStatus: paymentStatusEnum.default("paid"),
  paymentReference: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export type ApproveTenantRequestFormData = z.input<typeof approveTenantRequestSchema>;
export type ApproveTenantRequestData = z.output<typeof approveTenantRequestSchema>;

/** App-owner rejection payload for an `under_review` tenant request. */
export const rejectTenantRequestSchema = z.object({
  tenantId: z.string().uuid(),
  reason: z.string().trim().max(1000).optional().nullable(),
});

export type RejectTenantRequestData = z.infer<typeof rejectTenantRequestSchema>;

export type CompleteSignInResult =
  | { blocked: false; redirectPath: string }
  | { blocked: true; access: TenantAccessDenied };
