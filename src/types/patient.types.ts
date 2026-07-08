import { z } from "zod";

/** Patient self-service profile update (only fields a patient may edit). */
export const patientProfileUpdateSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(6, "Please enter a valid phone number")
    .max(30, "Phone number is too long"),
});

export type PatientProfileUpdateData = z.infer<typeof patientProfileUpdateSchema>;

/** Password change performed client-side via Supabase Auth. */
export const passwordChangeSchema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
