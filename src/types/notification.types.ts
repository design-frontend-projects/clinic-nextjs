import { z } from "zod";

/** Per-recipient read state. */
export const notificationStatusEnum = z.enum(["unread", "read"]);
export type NotificationStatus = z.infer<typeof notificationStatusEnum>;

/** Sender-set priority; `important` triggers the interrupting toast. */
export const notificationPriorityEnum = z.enum(["normal", "important"]);
export type NotificationPriority = z.infer<typeof notificationPriorityEnum>;

/** Optional message category (mirrors the CHECK in 13_in_app_notifications.sql). */
export const notificationCategoryEnum = z.enum([
  "announcement",
  "billing",
  "account_status",
  "policy",
  "shift_change",
  "handoff",
  "general",
]);
export type NotificationCategory = z.infer<typeof notificationCategoryEnum>;

/** How the sender chose recipients. */
export const audienceEnum = z.enum(["role_group", "individual"]);
export type Audience = z.infer<typeof audienceEnum>;

/**
 * Recipient roles a sender may target. Platform senders target `owner`;
 * a doctor targets `doctor` / `staff` / `pharmacist` within their tenant.
 */
export const targetRoleEnum = z.enum(["owner", "doctor", "staff", "pharmacist"]);
export type TargetRole = z.infer<typeof targetRoleEnum>;

/** Filter accepted by the inbox list ("all" = no status filter). */
export const notificationFilterEnum = z.enum(["all", "unread", "read"]);
export type NotificationFilter = z.infer<typeof notificationFilterEnum>;

/**
 * Compose payload. `role_group` sends require `targetRole`; `individual` sends
 * require a non-empty `targetProfileIds`. Cross-field rules are enforced by the
 * server action after it knows the sender's role.
 */
export const sendNotificationSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(150),
    body: z.string().trim().min(1, "Message is required").max(2000),
    priority: notificationPriorityEnum.default("normal"),
    category: notificationCategoryEnum.optional(),
    deep_link: z.string().trim().max(500).optional(),
    audience: audienceEnum,
    targetRole: targetRoleEnum.optional(),
    targetProfileIds: z.array(z.string().uuid()).max(500).optional(),
  })
  .refine(
    (v) => v.audience !== "role_group" || !!v.targetRole,
    { message: "Select a recipient group", path: ["targetRole"] },
  )
  .refine(
    (v) => v.audience !== "individual" || (v.targetProfileIds?.length ?? 0) > 0,
    { message: "Select at least one recipient", path: ["targetProfileIds"] },
  );

export type SendNotificationData = z.infer<typeof sendNotificationSchema>;

/** Paginated inbox query. */
export const listNotificationsSchema = z.object({
  status: notificationFilterEnum.default("all"),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListNotificationsData = z.infer<typeof listNotificationsSchema>;

/** Paginated "what I sent" query (sender-side history). */
export const listSentNotificationsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
export type ListSentNotificationsData = z.infer<typeof listSentNotificationsSchema>;

/** A notification row as rendered in the bell panel / center table. */
export type MyNotification = {
  id: string;
  group_id: string;
  sender_name: string | null;
  sender_role: string;
  title: string;
  body: string;
  category: NotificationCategory | null;
  priority: NotificationPriority;
  deep_link: string | null;
  status: NotificationStatus;
  created_at: string;
  read_at: string | null;
};

/** Paginated inbox result. */
export type MyNotificationsPage = {
  items: MyNotification[];
  total: number;
  page: number;
  pageSize: number;
};

/** A recipient the sender may pick in the individual-targeting picker. */
export type RecipientCandidate = {
  id: string;
  full_name: string | null;
  role: string;
};

/** One send collapsed from its per-recipient fan-out rows (sender's history). */
export type SentNotification = {
  group_id: string;
  title: string;
  body: string;
  category: NotificationCategory | null;
  priority: NotificationPriority;
  deep_link: string | null;
  recipient_count: number;
  created_at: string;
};

/** Paginated sent-history result. */
export type SentNotificationsPage = {
  items: SentNotification[];
  total: number;
  page: number;
  pageSize: number;
};

/** Result of a send fan-out. */
export type SendNotificationResult = { success: true; count: number } | { error: string };
