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

// ─── Clinic Form ────────────────────────────────────────────────
export const clinicSchema = z.object({
  name: z.string().min(2, "Clinic name is required"),
  registration_number: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  subscription_plan: z.string().optional(),
  is_primary: z.boolean().optional(),
});

export type ClinicFormData = z.infer<typeof clinicSchema>;

// ─── Branch Form ────────────────────────────────────────────────
export const branchSchema = z.object({
  name: z.string().min(2, "Branch name is required"),
  address: z.string().optional(),
  phone: z.string().optional(),
});

export type BranchFormData = z.infer<typeof branchSchema>;

// ─── Onboarding Cache (sessionStorage/localStorage) ──────────────────────────
export type OnboardingStep = "profile" | "clinic" | "branch";

export type OnboardingCache = {
  profileData: Partial<ProfileFormData>;
  clinicData: Partial<ClinicFormData>;
  branchData: Partial<BranchFormData>;
  currentStep: OnboardingStep;
  clinicId: string | null;
};
