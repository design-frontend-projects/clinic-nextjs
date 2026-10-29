"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedTenant } from "@/lib/auth";
import { assertSessionConnected, sendText, toChatId } from "@/lib/whatsapp/waha-client";
import { WahaError, toActionError, toHumanMessage } from "@/lib/errors";
import {
  sendWhatsAppSchema,
  listWhatsAppMessagesSchema,
  type SendWhatsAppData,
  type SendWhatsAppResult,
  type ListWhatsAppMessagesData,
  type WhatsAppMessagesPage,
  type WhatsAppRecipientCandidate,
  type WhatsAppTargetRole,
  type WhatsAppTemplate,
} from "@/types/whatsapp.types";

/**
 * Roles allowed to SEND WhatsApp messages. Patients are recipients only.
 *
 * NOTE (v1 seam): capability is role-based here to mirror `notifications.ts`.
 * To gate more finely later, introduce a `messaging.send` permission and check
 * it via `hasPermission()` from `@/lib/rbac`.
 */
const SENDER_ROLES = new Set([
  "owner",
  "admin",
  "super_admin",
  "app_owner",
  "doctor",
  "staff",
  "receptionist",
  "pharmacist",
]);

/** Tenant-member target roles resolved from the `profiles` table. */
const PROFILE_TARGET_ROLES = new Set<WhatsAppTargetRole>([
  "doctor",
  "staff",
  "pharmacist",
]);

const MAX_SENDS_PER_MINUTE = 10;

type Sender = Awaited<ReturnType<typeof requireAuthenticatedTenant>>;

/** A resolved, sendable recipient with a raw phone number. */
type Recipient = {
  kind: "patient" | "profile";
  id: string;
  role: WhatsAppTargetRole;
  name: string | null;
  phone: string | null;
};

/** Substitute `{{token}}` placeholders in a template body. */
function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key] ?? "");
}

/** Resolve the recipient set for a send, scoped to the sender's tenant. */
async function resolveRecipients(
  input: SendWhatsAppData,
  sender: Sender,
): Promise<Recipient[] | { error: string }> {
  const clinicId = sender.clinicId;

  if (input.audience === "role_group") {
    const role = input.targetRole!;

    if (role === "patient") {
      if (!clinicId) return { error: "No clinic context for patient recipients." };
      const rows = await prisma.patients.findMany({
        where: { clinic_id: clinicId, phone: { not: null } },
        select: { id: true, first_name: true, last_name: true, phone: true },
        take: 500,
      });
      return rows.map((r) => ({
        kind: "patient" as const,
        id: r.id,
        role: "patient" as const,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        phone: r.phone,
      }));
    }

    if (role === "app_owner") {
      const rows = await prisma.profiles.findMany({
        where: { role: "app_owner", phone: { not: null } },
        select: { id: true, full_name: true, phone: true },
        take: 500,
      });
      return rows.map((r) => ({
        kind: "profile" as const,
        id: r.id,
        role: "app_owner" as const,
        name: r.full_name,
        phone: r.phone,
      }));
    }

    // doctor / staff / pharmacist — tenant members.
    if (!clinicId) return { error: "No clinic context for these recipients." };
    const rows = await prisma.profiles.findMany({
      where: { tenant_id: clinicId, role, phone: { not: null } },
      select: { id: true, full_name: true, phone: true, role: true },
      take: 500,
    });
    return rows.map((r) => ({
      kind: "profile" as const,
      id: r.id,
      role,
      name: r.full_name,
      phone: r.phone,
    }));
  }

  // individual — union of selected profiles and patients within the tenant.
  const recipients: Recipient[] = [];

  if ((input.targetPatientIds?.length ?? 0) > 0) {
    if (!clinicId) return { error: "No clinic context for patient recipients." };
    const patients = await prisma.patients.findMany({
      where: { id: { in: input.targetPatientIds! }, clinic_id: clinicId },
      select: { id: true, first_name: true, last_name: true, phone: true },
    });
    recipients.push(
      ...patients.map((r) => ({
        kind: "patient" as const,
        id: r.id,
        role: "patient" as const,
        name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        phone: r.phone,
      })),
    );
  }

  if ((input.targetProfileIds?.length ?? 0) > 0) {
    const profiles = await prisma.profiles.findMany({
      where: {
        id: { in: input.targetProfileIds! },
        // app_owner is cross-tenant; tenant members must match the sender's clinic.
        OR: [
          { role: "app_owner" },
          ...(clinicId ? [{ tenant_id: clinicId }] : []),
        ],
      },
      select: { id: true, full_name: true, phone: true, role: true },
    });
    recipients.push(
      ...profiles.map((r) => ({
        kind: "profile" as const,
        id: r.id,
        role: (r.role ?? "staff") as WhatsAppTargetRole,
        name: r.full_name,
        phone: r.phone,
      })),
    );
  }

  if (recipients.length === 0) return { error: "No valid recipients selected." };
  return recipients;
}

/** Reject if the sender has exceeded the per-minute send cap. */
async function isRateLimited(senderId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 60_000);
  const recentGroups = await prisma.whatsapp_messages.groupBy({
    by: ["group_id"],
    where: { sender_id: senderId, created_at: { gt: cutoff } },
  });
  return recentGroups.length >= MAX_SENDS_PER_MINUTE;
}

/**
 * Compose + fan out a WhatsApp message to all resolved recipients.
 * Each recipient is attempted independently; one bad number never fails the
 * whole batch, and every attempt is written to the `whatsapp_messages` log.
 */
export async function sendWhatsAppMessage(
  data: SendWhatsAppData,
): Promise<SendWhatsAppResult> {
  try {
    const parsed = sendWhatsAppSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid message." };
    }

    const sender = await requireAuthenticatedTenant();
    if (!SENDER_ROLES.has(sender.role)) {
      return { error: "You are not allowed to send WhatsApp messages." };
    }

    if (await isRateLimited(sender.profileId)) {
      return { error: "You're sending too fast. Please wait a moment and try again." };
    }

    // Resolve the template body (if any) up front.
    let templateBody: string | null = null;
    let templateKey: string | null = null;
    if (parsed.data.templateId) {
      const template = await prisma.whatsapp_templates.findFirst({
        where: {
          id: parsed.data.templateId,
          tenant_id: sender.clinicId ?? undefined,
          is_active: true,
        },
        select: { key: true, body_en: true },
      });
      if (!template) return { error: "The selected template is unavailable." };
      templateBody = template.body_en;
      templateKey = template.key;
    }

    const recipients = await resolveRecipients(parsed.data, sender);
    if ("error" in recipients) return recipients;

    // Fail fast with a single clear error if WhatsApp isn't linked / reachable.
    await assertSessionConnected();

    const groupId = randomUUID();
    const clinicName = sender.clinicName ?? "";
    const senderName = sender.fullName ?? "";

    const results = await Promise.allSettled(
      recipients.map(async (r) => {
        const text = renderTemplate(templateBody ?? parsed.data.body ?? "", {
          name: r.name ?? "",
          patient_name: r.name ?? "",
          clinic_name: clinicName,
          sender_name: senderName,
        });

        try {
          const chatId = toChatId(r.phone); // throws invalid_number → logged as failed
          const sent = await sendText({ chatId, text });
          return {
            recipient: r,
            text,
            status: "sent" as const,
            wahaId: sent.id,
            error: null as string | null,
            phone: r.phone ?? "",
          };
        } catch (err) {
          // Auth/unreachable/session errors abort the whole batch (re-throw);
          // per-recipient problems (invalid number) are logged and skipped.
          if (err instanceof WahaError && err.code !== "invalid_number") throw err;
          return {
            recipient: r,
            text,
            status: "failed" as const,
            wahaId: null as string | null,
            error: toHumanMessage(err),
            phone: r.phone ?? "",
          };
        }
      }),
    );

    // If any recipient rejected with a batch-level gateway error, surface it.
    const fatal = results.find((x) => x.status === "rejected");
    if (fatal && fatal.status === "rejected") {
      return toActionError(fatal.reason);
    }

    const rows = results.flatMap((x) => (x.status === "fulfilled" ? [x.value] : []));

    await prisma.whatsapp_messages.createMany({
      data: rows.map((row) => ({
        tenant_id: sender.clinicId,
        group_id: groupId,
        sender_id: sender.profileId,
        sender_role: sender.role,
        recipient_kind: row.recipient.kind,
        recipient_id: row.recipient.id,
        recipient_role: row.recipient.role,
        to_phone: row.phone,
        body: row.text,
        template_key: templateKey,
        status: row.status,
        waha_message_id: row.wahaId,
        error: row.error,
        created_by: sender.profileId,
      })),
    });

    const sent = rows.filter((r) => r.status === "sent").length;
    const failed = rows.filter((r) => r.status === "failed").length;
    const skipped = recipients.length - rows.length;

    revalidatePath("/admin/messages");
    return { success: true, sent, failed, skipped };
  } catch (error) {
    console.error("sendWhatsAppMessage error:", error);
    return toActionError(error, "Failed to send the WhatsApp message.");
  }
}

/** Active per-tenant templates for the composer picker. */
export async function getWhatsAppTemplates(): Promise<WhatsAppTemplate[]> {
  try {
    const sender = await requireAuthenticatedTenant();
    if (!sender.clinicId) return [];
    const rows = await prisma.whatsapp_templates.findMany({
      where: { tenant_id: sender.clinicId, is_active: true },
      select: { id: true, key: true, name: true, body_en: true, body_ar: true, variables: true },
      orderBy: { name: "asc" },
    });
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      body_en: r.body_en,
      body_ar: r.body_ar,
      variables: Array.isArray(r.variables) ? (r.variables as string[]) : [],
    }));
  } catch (error) {
    console.error("getWhatsAppTemplates error:", error);
    return [];
  }
}

/** Candidate recipients for the individual picker, scoped to the tenant. */
export async function getWhatsAppRecipientCandidates(
  role: WhatsAppTargetRole,
  search?: string,
): Promise<WhatsAppRecipientCandidate[]> {
  try {
    const sender = await requireAuthenticatedTenant();
    if (!SENDER_ROLES.has(sender.role)) return [];
    const term = search?.trim();

    if (role === "patient") {
      if (!sender.clinicId) return [];
      const rows = await prisma.patients.findMany({
        where: {
          clinic_id: sender.clinicId,
          ...(term
            ? {
                OR: [
                  { first_name: { contains: term, mode: "insensitive" } },
                  { last_name: { contains: term, mode: "insensitive" } },
                  { phone: { contains: term, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: { id: true, first_name: true, last_name: true, phone: true },
        orderBy: { first_name: "asc" },
        take: 50,
      });
      return rows.map((r) => ({
        id: r.id,
        full_name: [r.first_name, r.last_name].filter(Boolean).join(" ") || null,
        role: "patient",
        has_phone: !!r.phone,
      }));
    }

    const isProfileRole = PROFILE_TARGET_ROLES.has(role) || role === "app_owner";
    if (!isProfileRole) return [];

    const rows = await prisma.profiles.findMany({
      where: {
        ...(role === "app_owner"
          ? { role: "app_owner" }
          : { tenant_id: sender.clinicId ?? undefined, role }),
        ...(term ? { full_name: { contains: term, mode: "insensitive" as const } } : {}),
      },
      select: { id: true, full_name: true, phone: true },
      orderBy: { full_name: "asc" },
      take: 50,
    });
    return rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      role,
      has_phone: !!r.phone,
    }));
  } catch (error) {
    console.error("getWhatsAppRecipientCandidates error:", error);
    return [];
  }
}

/** The caller's WhatsApp send history (delivery log), paginated. */
export async function getSentWhatsAppMessages(
  data: ListWhatsAppMessagesData,
): Promise<WhatsAppMessagesPage> {
  const fallback = { items: [], total: 0, page: 1, pageSize: 20 };
  try {
    const parsed = listWhatsAppMessagesSchema.safeParse(data);
    if (!parsed.success) return fallback;
    const { page, pageSize } = parsed.data;

    const sender = await requireAuthenticatedTenant();
    const where = { sender_id: sender.profileId };

    const [rows, total] = await Promise.all([
      prisma.whatsapp_messages.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          group_id: true,
          recipient_role: true,
          to_phone: true,
          body: true,
          status: true,
          error: true,
          created_at: true,
        },
      }),
      prisma.whatsapp_messages.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        group_id: r.group_id,
        recipient_role: r.recipient_role,
        to_phone: r.to_phone,
        body: r.body,
        status: r.status as "sent" | "failed",
        error: r.error,
        created_at: r.created_at.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  } catch (error) {
    console.error("getSentWhatsAppMessages error:", error);
    return fallback;
  }
}
