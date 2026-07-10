import { z } from "zod";

/**
 * Payload for the app-owner "create tenant" action: owner account, clinic,
 * plan, main branch, and optional doctor specialties — everything the
 * self-service onboarding wizard collects, submitted in a single step.
 */
export const createTenantSchema = z.object({
  owner: z.object({
    full_name: z.string().min(2, "Owner name must be at least 2 characters"),
    email: z.string().email("Enter a valid owner email"),
    phone: z.string().optional().or(z.literal("")),
  }),
  clinic: z.object({
    name: z.string().min(2, "Clinic name must be at least 2 characters"),
    registration_number: z.string().optional().or(z.literal("")),
    email: z
      .string()
      .email("Enter a valid clinic email")
      .optional()
      .or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
  }),
  plan_id: z.string().uuid("Select a subscription plan"),
  branch: z.object({
    name: z.string().min(1, "Branch name is required").default("Main Branch"),
    address: z.string().optional().or(z.literal("")),
    phone: z.string().optional().or(z.literal("")),
  }),
  specialtyIds: z.array(z.string().uuid()).optional().default([]),
});

export type CreateTenantFormData = z.input<typeof createTenantSchema>;
export type CreateTenantData = z.output<typeof createTenantSchema>;

export type CreateTenantResult =
  | {
      success: true;
      tenantId: string;
      /** Plaintext temp password — surfaced once to the app-owner only. */
      tempPassword: string;
      ownerEmail: string;
      ownerName: string;
      /** Whether the set-password email was dispatched successfully. */
      emailSent: boolean;
    }
  | { error: string };

/** Serializable plan option for the create-tenant form (Decimal → number). */
export type PlanOption = {
  id: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
};
