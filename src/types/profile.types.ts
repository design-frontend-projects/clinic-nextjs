import { z } from "zod";

const PHONE_REGEX = /^[+\d\s\-().]{6,30}$/;
const OTP_REGEX = /^\d{6,8}$/;

export const profileDetailsUpdateSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name is too long"),
});

export type ProfileDetailsUpdateInput = z.infer<
  typeof profileDetailsUpdateSchema
>;

export const phoneChangeRequestSchema = z.object({
  newPhone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(30, "Phone number is too long")
    .regex(PHONE_REGEX, "Phone number contains invalid characters"),
});

export type PhoneChangeRequestInput = z.infer<typeof phoneChangeRequestSchema>;

export const phoneChangeVerifySchema = z.object({
  newPhone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(30, "Phone number is too long")
    .regex(PHONE_REGEX, "Phone number contains invalid characters"),
  otp: z
    .string()
    .trim()
    .regex(OTP_REGEX, "Verification code must be 6 to 8 digits"),
});

export type PhoneChangeVerifyInput = z.infer<typeof phoneChangeVerifySchema>;

export const profileFormSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(120, "Full name is too long"),
  phone: z
    .string()
    .trim()
    .refine(
      (val) => val.length === 0 || PHONE_REGEX.test(val),
      "Please enter a valid phone number",
    ),
});

export type ProfileFormData = z.infer<typeof profileFormSchema>;

export const profilePasswordSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ProfilePasswordFormData = z.infer<typeof profilePasswordSchema>;

export interface ProfileBranchSummary {
  id: string;
  name: string;
  clinic_name: string | null;
  is_primary: boolean;
}

export interface UserProfileView {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  specialty: string | null;
  is_owner: boolean;
  created_at: string;
  clinic: {
    id: string;
    name: string;
  } | null;
  branches: ProfileBranchSummary[];
  has_patient_record: boolean;
}

export type ProfileActionErrorCode =
  | "validation_error"
  | "unauthorized"
  | "no_email"
  | "same_phone"
  | "duplicate_phone"
  | "rate_limited"
  | "otp_send_failed"
  | "otp_expired"
  | "invalid_pending_request"
  | "invalid_otp"
  | "unexpected_error";

export type UpdateProfileDetailsResult =
  | { success: true; full_name: string }
  | { success: false; error: string; code: ProfileActionErrorCode };

export type RequestPhoneChangeOtpResult =
  | { success: true; maskedEmail: string; expiresInSeconds: number }
  | { success: false; error: string; code: ProfileActionErrorCode };

export type VerifyPhoneChangeOtpResult =
  | { success: true; phone: string }
  | { success: false; error: string; code: ProfileActionErrorCode };
