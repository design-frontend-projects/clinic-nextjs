import { z } from "zod";

/** How the sender chose recipients. */
export const whatsappAudienceEnum = z.enum(["role_group", "individual"]);
export type WhatsAppAudience = z.infer<typeof whatsappAudienceEnum>;

/**
 * Recipient groups a WhatsApp send may target. Unlike the in-app notification
 * inbox, WhatsApp reaches external contacts too — `patient` is included, and
 * `app_owner` covers the platform owner.
 */
export const whatsappTargetRoleEnum = z.enum([
  "patient",
  "doctor",
  "staff",
  "pharmacist",
  "app_owner",
]);
export type WhatsAppTargetRole = z.infer<typeof whatsappTargetRoleEnum>;

/**
 * Compose payload. Either a free-text `body` or a `templateId` must be present.
 * `role_group` sends require `targetRole`; `individual` sends require at least
 * one selected id (a profile id or a patient id depending on the picker).
 */
export const sendWhatsAppSchema = z
  .object({
    body: z.string().trim().max(4096).optional(),
    templateId: z.string().uuid().optional(),
    audience: whatsappAudienceEnum,
    targetRole: whatsappTargetRoleEnum.optional(),
    targetProfileIds: z.array(z.string().uuid()).max(500).optional(),
    targetPatientIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine((v) => !!v.body?.trim() || !!v.templateId, {
    message: "Enter a message or pick a template",
    path: ["body"],
  })
  .refine((v) => v.audience !== "role_group" || !!v.targetRole, {
    message: "Select a recipient group",
    path: ["targetRole"],
  })
  .refine(
    (v) =>
      v.audience !== "individual" ||
      (v.targetProfileIds?.length ?? 0) > 0 ||
      (v.targetPatientIds?.length ?? 0) > 0,
    { message: "Select at least one recipient", path: ["targetProfileIds"] },
  );

export type SendWhatsAppData = z.infer<typeof sendWhatsAppSchema>;

/** Paginated sent-history query. */
export const listWhatsAppMessagesSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListWhatsAppMessagesData = z.infer<typeof listWhatsAppMessagesSchema>;

/** A recipient the sender may pick in the individual-targeting picker. */
export type WhatsAppRecipientCandidate = {
  /** profiles.id or patients.id */
  id: string;
  full_name: string | null;
  role: WhatsAppTargetRole;
  /** Whether this contact has a usable phone number. */
  has_phone: boolean;
};

/** A per-tenant template as offered in the composer. */
export type WhatsAppTemplate = {
  id: string;
  key: string;
  name: string;
  body_en: string;
  body_ar: string | null;
  variables: string[];
};

/** One delivery-log row for the sent-history view. */
export type WhatsAppMessageLog = {
  id: string;
  group_id: string;
  recipient_role: string | null;
  to_phone: string;
  body: string;
  status: "sent" | "failed";
  error: string | null;
  created_at: string;
};

/** Paginated sent-history result. */
export type WhatsAppMessagesPage = {
  items: WhatsAppMessageLog[];
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Result of a send fan-out. `sent` / `failed` are per-recipient counts, and
 * `skipped` counts recipients dropped for a missing/invalid phone number.
 */
export type SendWhatsAppResult =
  | { success: true; sent: number; failed: number; skipped: number }
  | { error: string };
