import { z } from "zod";

// ─── Profile Form ───────────────────────────────────────────────
export const profileSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  role: z.string(),
  specialty: z.string().optional(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

// ─── Branch Form ────────────────────────────────────────────────
export const branchSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export type BranchFormData = z.infer<typeof branchSchema>;

export const onboardingBranchesSchema = z.array(branchSchema);

export interface OnboardingBranchItem {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

// ─── Clinic Form ────────────────────────────────────────────────
export const clinicSchema = z.object({
  name: z.string().trim().min(2, "Clinic name is required"),
  registration_number: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  subscription_plan: z.string().optional(),
  specialty_id: z.string().uuid().optional(),
  is_primary: z.boolean().optional(),
  branch_ids: z
    .array(z.string().uuid())
    .min(1, "Please select at least one branch"),
  primary_branch_id: z.string().uuid().optional(),
});

export type ClinicFormData = z.infer<typeof clinicSchema>;

// ─── Subscription Form ──────────────────────────────────────────────
export const subscriptionSchema = z.object({
  plan_id: z.string().min(1, "Please select a plan"),
});

export type SubscriptionFormData = z.infer<typeof subscriptionSchema>;

// ─── Onboarding Cache (sessionStorage/localStorage) ──────────────────────────
export type OnboardingStep =
  | "subscription"
  | "profile"
  | "branch"
  | "clinic"
  | "specialties";

export type OnboardingCache = {
  profileData: Partial<ProfileFormData>;
  clinicData: Partial<ClinicFormData>;
  branches: OnboardingBranchItem[];
  subscriptionData: Partial<SubscriptionFormData>;
  specialtyIds: string[];
  currentStep: OnboardingStep;
  clinicId: string | null;
};
