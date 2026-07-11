"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuthenticatedTenant } from "@/lib/auth";
import { isBypassRole } from "@/lib/rbac";
import {
  sendNotificationSchema,
  listNotificationsSchema,
  type SendNotificationData,
  type ListNotificationsData,
  type MyNotificationsPage,
  type NotificationCategory,
  type NotificationPriority,
  type NotificationStatus,
  type RecipientCandidate,
  type SendNotificationResult,
  type TargetRole,
} from "@/types/notification.types";

/**
 * Platform operators broadcast to tenant owners cross-tenant. `admin`/`owner`
 * are tenant super-users (bypass) and send within their own tenant; `doctor`
 * sends to their tenant's care team. Everyone else is rejected.
 *
 * NOTE (v1 seam): sender capability is role-based here. To gate more finely
 * later, introduce a `notification.send` permission and check it via
 * `hasPermission()` from `@/lib/rbac` alongside these role sets.
 */
const PLATFORM_SENDER_ROLES = new Set(["app_owner", "super_admin"]);
/** Recipient roles a tenant sender may target, keyed by the sender's role. */
const TENANT_TARGETS_BY_SENDER: Record<string, ReadonlySet<TargetRole>> = {
  doctor: new Set(["doctor", "staff", "pharmacist"]),
  owner: new Set(["owner", "doctor", "staff", "pharmacist"]),
  admin: new Set(["owner", "doctor", "staff", "pharmacist"]),
};

/** Max distinct sends per sender per minute (a broadcast counts as one send). */
const MAX_SENDS_PER_MINUTE = 10;

type Sender = Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
type SenderCapability =
  | { scope: "platform" }
  | { scope: "tenant"; clinicId: string; allowedTargets: ReadonlySet<TargetRole> };

/** Resolve what the caller is allowed to send, or null if not a sender. */
function resolveSenderCapability(sender: Sender): SenderCapability | null {
  if (PLATFORM_SENDER_ROLES.has(sender.role)) {
    return { scope: "platform" };
  }
  const allowedTargets = TENANT_TARGETS_BY_SENDER[sender.role];
  if (allowedTargets && (sender.role === "doctor" || isBypassRole(sender.role))) {
    if (!sender.clinicId) return null;
    return { scope: "tenant", clinicId: sender.clinicId, allowedTargets };
  }
  return null;
}

type ResolvedRecipient = { id: string; role: string; tenantId: string | null };

/** Resolve the recipient set for a send, enforcing the sender's scope/targets. */
async function resolveRecipients(
  input: SendNotificationData,
  capability: SenderCapability,
): Promise<ResolvedRecipient[] | { error: string }> {
  if (capability.scope === "platform") {
    // Platform senders may only target tenant owners.
    if (input.audience === "role_group" && input.targetRole !== "owner") {
      return { error: "Platform notifications can only target tenant owners." };
    }
    if (input.audience === "role_group") {
      const owners = await prisma.profiles.findMany({
        where: { role: "owner", status: "active" },
        select: { id: true, role: true, tenant_id: true },
      });
      return owners.map((o) => ({ id: o.id, role: "owner", tenantId: o.tenant_id }));
    }
    // individual: every target must be an owner.
    const owners = await prisma.profiles.findMany({
      where: { id: { in: input.targetProfileIds ?? [] }, role: "owner", status: "active" },
      select: { id: true, role: true, tenant_id: true },
    });
    if (owners.length === 0) return { error: "No valid owner recipients selected." };
    return owners.map((o) => ({ id: o.id, role: "owner", tenantId: o.tenant_id }));
  }

  // Tenant scope — recipients are always within the sender's clinic.
  const { clinicId, allowedTargets } = capability;
  if (input.audience === "role_group") {
    if (!input.targetRole || !allowedTargets.has(input.targetRole)) {
      return { error: "You are not allowed to send to that recipient group." };
    }
    const people = await prisma.profiles.findMany({
      where: { tenant_id: clinicId, role: input.targetRole, status: "active" },
      select: { id: true, role: true },
    });
    return people.map((p) => ({ id: p.id, role: p.role ?? input.targetRole!, tenantId: clinicId }));
  }
  // individual: targets must be in the sender's tenant with an allowed role.
  const people = await prisma.profiles.findMany({
    where: {
      id: { in: input.targetProfileIds ?? [] },
      tenant_id: clinicId,
      role: { in: [...allowedTargets] },
      status: "active",
    },
    select: { id: true, role: true },
  });
  if (people.length === 0) return { error: "No valid recipients selected." };
  return people.map((p) => ({ id: p.id, role: p.role ?? "staff", tenantId: clinicId }));
}

/** Reject if the sender has exceeded the per-minute send cap. */
async function isRateLimited(senderId: string): Promise<boolean> {
  const cutoff = new Date(Date.now() - 60_000);
  const recentGroups = await prisma.notifications.groupBy({
    by: ["group_id"],
    where: { sender_id: senderId, created_at: { gt: cutoff } },
  });
  return recentGroups.length >= MAX_SENDS_PER_MINUTE;
}

/** Compose + fan out a notification to all resolved recipients. */
export async function sendNotification(
  data: SendNotificationData,
): Promise<SendNotificationResult> {
  try {
    const parsed = sendNotificationSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid notification." };
    }

    const sender = await requireAuthenticatedTenant();
    const capability = resolveSenderCapability(sender);
    if (!capability) {
      return { error: "You are not allowed to send notifications." };
    }

    if (await isRateLimited(sender.profileId)) {
      return { error: "You're sending too fast. Please wait a moment and try again." };
    }

    const recipients = await resolveRecipients(parsed.data, capability);
    if ("error" in recipients) return recipients;

    // Never notify the sender themselves.
    const targets = recipients.filter((r) => r.id !== sender.profileId);
    // if (targets.length === 0) {
    //   return { error: "No recipients matched." };
    // }

    const groupId = randomUUID();
    const now = new Date();
    await prisma.notifications.createMany({
      data: targets.map((r) => ({
        tenant_id: r.tenantId,
        group_id: groupId,
        sender_id: sender.profileId,
        sender_role: sender.role,
        sender_name: sender.fullName ?? null,
        recipient_id: r.id,
        recipient_role: r.role,
        title: parsed.data.title,
        body: parsed.data.body,
        category: parsed.data.category ?? null,
        priority: parsed.data.priority,
        deep_link: parsed.data.deep_link || null,
        delivered_at: now,
        created_by: sender.profileId,
      })),
      skipDuplicates: true,
    });

    revalidatePath("/settings/notifications");
    return { success: true, count: targets.length };
  } catch (error) {
    console.error("sendNotification error:", error);
    return { error: "Failed to send the notification." };
  }
}

/** The current user's inbox, filtered by read state and paginated. */
export async function getMyNotifications(
  data: ListNotificationsData,
): Promise<MyNotificationsPage> {
  try {
    const parsed = listNotificationsSchema.safeParse(data);
    if (!parsed.success) {
      return { items: [], total: 0, page: 1, pageSize: 20 };
    }
    const { status, page, pageSize } = parsed.data;
    const sender = await requireAuthenticatedTenant();

    const where = {
      recipient_id: sender.profileId,
      deleted_at: null,
      ...(status !== "all" ? { status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.notifications.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          group_id: true,
          sender_name: true,
          sender_role: true,
          title: true,
          body: true,
          category: true,
          priority: true,
          deep_link: true,
          status: true,
          created_at: true,
          read_at: true,
        },
      }),
      prisma.notifications.count({ where }),
    ]);

    return {
      items: rows.map((r) => ({
        id: r.id,
        group_id: r.group_id,
        sender_name: r.sender_name,
        sender_role: r.sender_role,
        title: r.title,
        body: r.body,
        category: r.category as NotificationCategory | null,
        priority: r.priority as NotificationPriority,
        deep_link: r.deep_link,
        status: r.status as NotificationStatus,
        created_at: r.created_at.toISOString(),
        read_at: r.read_at?.toISOString() ?? null,
      })),
      total,
      page,
      pageSize,
    } satisfies MyNotificationsPage;
  } catch (error) {
    console.error("getMyNotifications error:", error);
    return { items: [], total: 0, page: 1, pageSize: 20 };
  }
}

/** Unread badge count for the current user. */
export async function getUnreadCount(): Promise<number> {
  try {
    const sender = await requireAuthenticatedTenant();
    return prisma.notifications.count({
      where: { recipient_id: sender.profileId, status: "unread", deleted_at: null },
    });
  } catch {
    return 0;
  }
}

/** Mark a single notification read (own rows only). */
export async function markNotificationRead(
  id: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const sender = await requireAuthenticatedTenant();
    const result = await prisma.notifications.updateMany({
      where: { id, recipient_id: sender.profileId, status: "unread" },
      data: { status: "read", read_at: new Date() },
    });
    if (result.count === 0) {
      // Idempotent: already read or not found — treat as success for the UI.
      return { success: true };
    }
    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (error) {
    console.error("markNotificationRead error:", error);
    return { error: "Failed to update the notification." };
  }
}

/** Mark every unread notification read for the current user. */
export async function markAllNotificationsRead(): Promise<
  { success: true; count: number } | { error: string }
> {
  try {
    const sender = await requireAuthenticatedTenant();
    const result = await prisma.notifications.updateMany({
      where: { recipient_id: sender.profileId, status: "unread" },
      data: { status: "read", read_at: new Date() },
    });
    revalidatePath("/settings/notifications");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("markAllNotificationsRead error:", error);
    return { error: "Failed to update notifications." };
  }
}

/**
 * Candidate recipients for the individual-targeting picker, scoped to what the
 * caller is allowed to send to. Returns [] for non-senders.
 */
export async function getRecipientCandidates(
  search?: string,
): Promise<RecipientCandidate[]> {
  try {
    const sender = await requireAuthenticatedTenant();
    const capability = resolveSenderCapability(sender);
    if (!capability) return [];

    const nameFilter = search?.trim()
      ? { full_name: { contains: search.trim(), mode: "insensitive" as const } }
      : {};

    const rows = await prisma.profiles.findMany({
      where:
        capability.scope === "platform"
          ? { role: "owner", status: "active", ...nameFilter }
          : {
              tenant_id: capability.clinicId,
              role: { in: [...capability.allowedTargets] },
              status: "active",
              id: { not: sender.profileId },
              ...nameFilter,
            },
      select: { id: true, full_name: true, role: true },
      orderBy: { full_name: "asc" },
      take: 50,
    });

    return rows.map((r) => ({ id: r.id, full_name: r.full_name, role: r.role ?? "" }));
  } catch (error) {
    console.error("getRecipientCandidates error:", error);
    return [];
  }
}
