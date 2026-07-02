import { z } from "zod";

export const staffInviteSchema = z.object({
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Invalid email address"),
  specialty: z.string().optional(),
});

export type StaffInviteFormData = z.infer<typeof staffInviteSchema>;
