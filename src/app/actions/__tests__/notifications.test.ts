import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendNotificationSchema } from "@/types/notification.types";

// --- Mocks ---------------------------------------------------------------
// vi.hoisted so the mock object exists before the hoisted vi.mock factory runs.
const prismaMock = vi.hoisted(() => ({
  notifications: {
    createMany: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    groupBy: vi.fn(),
  },
  profiles: { findMany: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

vi.mock("@/lib/auth", () => ({ requireAuthenticatedTenant: vi.fn() }));

// Real bypass logic (pure) without importing the RBAC/eval graph.
vi.mock("@/lib/rbac", () => ({
  isBypassRole: (role?: string | null) =>
    !!role && new Set(["owner", "admin", "app_owner"]).has(role),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { requireAuthenticatedTenant } from "@/lib/auth";
import {
  sendNotification,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadCount,
} from "@/app/actions/notifications";

const mockSender = vi.mocked(requireAuthenticatedTenant);

function asSender(over: Partial<Record<string, unknown>>) {
  return {
    userId: "auth-1",
    orgId: null,
    profileId: "sender-1",
    role: "doctor",
    fullName: "Dr. Test",
    email: "dr@test.io",
    is_profile_completed: true,
    is_owner: false,
    clinicId: "clinic-A",
    subscriptionPlan: "free",
    branchId: null,
    auth_user_id: "auth-1",
    ...over,
  } as unknown as Awaited<ReturnType<typeof requireAuthenticatedTenant>>;
}

const baseInput = {
  title: "Heads up",
  body: "Shift starts at 9",
  priority: "normal" as const,
  audience: "role_group" as const,
  targetRole: "staff" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notifications.groupBy.mockResolvedValue([]); // not rate limited
  prismaMock.notifications.createMany.mockResolvedValue({ count: 0 });
});

// --- Schema --------------------------------------------------------------
describe("sendNotificationSchema", () => {
  it("requires a target role for role_group sends", () => {
    const r = sendNotificationSchema.safeParse({ ...baseInput, targetRole: undefined });
    expect(r.success).toBe(false);
  });

  it("requires recipients for individual sends", () => {
    const r = sendNotificationSchema.safeParse({
      title: "x",
      body: "y",
      audience: "individual",
      targetProfileIds: [],
    });
    expect(r.success).toBe(false);
  });

  it("rejects an empty title", () => {
    const r = sendNotificationSchema.safeParse({ ...baseInput, title: "" });
    expect(r.success).toBe(false);
  });

  it("accepts a valid role_group payload", () => {
    expect(sendNotificationSchema.safeParse(baseInput).success).toBe(true);
  });
});

// --- Authorization -------------------------------------------------------
describe("sendNotification authorization", () => {
  it("rejects a non-sender role (staff)", async () => {
    mockSender.mockResolvedValue(asSender({ role: "staff" }));
    const res = await sendNotification(baseInput);
    expect(res).toEqual({ error: "You are not allowed to send notifications." });
    expect(prismaMock.notifications.createMany).not.toHaveBeenCalled();
  });

  it("rejects a doctor targeting owners (out of allowed set)", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor" }));
    const res = await sendNotification({ ...baseInput, targetRole: "owner" });
    expect(res).toEqual({ error: "You are not allowed to send to that recipient group." });
  });

  it("rejects a platform sender targeting a non-owner group", async () => {
    mockSender.mockResolvedValue(asSender({ role: "app_owner" }));
    const res = await sendNotification({ ...baseInput, targetRole: "staff" });
    expect(res).toEqual({ error: "Platform notifications can only target tenant owners." });
  });
});

// --- Recipient resolution & fan-out --------------------------------------
describe("sendNotification fan-out", () => {
  it("fans a doctor role_group send out to tenant staff", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor", profileId: "doc-1" }));
    prismaMock.profiles.findMany.mockResolvedValue([
      { id: "s1", role: "staff" },
      { id: "s2", role: "staff" },
    ]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 2 });

    const res = await sendNotification(baseInput);

    expect(res).toEqual({ success: true, count: 2 });
    const call = prismaMock.notifications.createMany.mock.calls[0][0];
    expect(call.data).toHaveLength(2);
    expect(call.skipDuplicates).toBe(true);
    // all rows share one group_id, scoped to the sender's clinic
    const groupIds = new Set(call.data.map((r: { group_id: string }) => r.group_id));
    expect(groupIds.size).toBe(1);
    expect(call.data.every((r: { tenant_id: string }) => r.tenant_id === "clinic-A")).toBe(true);
    expect(call.data.map((r: { recipient_id: string }) => r.recipient_id)).toEqual(["s1", "s2"]);
  });

  it("scopes tenant queries to the sender's clinic", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor" }));
    prismaMock.profiles.findMany.mockResolvedValue([{ id: "s1", role: "staff" }]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 1 });

    await sendNotification(baseInput);

    const where = prismaMock.profiles.findMany.mock.calls[0][0].where;
    expect(where.tenant_id).toBe("clinic-A");
    expect(where.role).toBe("staff");
    expect(where.status).toBe("active");
  });

  it("resolves platform owner sends across tenants, preserving each owner's tenant", async () => {
    mockSender.mockResolvedValue(asSender({ role: "app_owner", profileId: "ao-1" }));
    prismaMock.profiles.findMany.mockResolvedValue([
      { id: "o1", role: "owner", tenant_id: "t1" },
      { id: "o2", role: "owner", tenant_id: "t2" },
    ]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 2 });

    const res = await sendNotification({ ...baseInput, targetRole: "owner" });

    expect(res).toEqual({ success: true, count: 2 });
    const rows = prismaMock.notifications.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { tenant_id: string }) => r.tenant_id)).toEqual(["t1", "t2"]);
  });

  it("never notifies the sender themselves", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor", profileId: "doc-1" }));
    prismaMock.profiles.findMany.mockResolvedValue([
      { id: "doc-1", role: "staff" }, // sender appears in the group
      { id: "s2", role: "staff" },
    ]);
    prismaMock.notifications.createMany.mockResolvedValue({ count: 1 });

    const res = await sendNotification(baseInput);

    expect(res).toEqual({ success: true, count: 1 });
    const rows = prismaMock.notifications.createMany.mock.calls[0][0].data;
    expect(rows.map((r: { recipient_id: string }) => r.recipient_id)).toEqual(["s2"]);
  });

  it("returns an error when no recipients match", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor" }));
    prismaMock.profiles.findMany.mockResolvedValue([]);
    const res = await sendNotification(baseInput);
    expect(res).toEqual({ error: "No recipients matched." });
  });

  it("rejects individual sends with no valid recipients", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor" }));
    prismaMock.profiles.findMany.mockResolvedValue([]);
    const res = await sendNotification({
      title: "x",
      body: "y",
      priority: "normal",
      audience: "individual",
      targetProfileIds: ["11111111-1111-4111-8111-111111111111"],
    });
    expect(res).toEqual({ error: "No valid recipients selected." });
  });
});

// --- Rate limiting -------------------------------------------------------
describe("sendNotification rate limiting", () => {
  it("rejects when the per-minute send cap is exceeded", async () => {
    mockSender.mockResolvedValue(asSender({ role: "doctor" }));
    prismaMock.notifications.groupBy.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ group_id: `g${i}` })),
    );
    const res = await sendNotification(baseInput);
    expect(res).toEqual({
      error: "You're sending too fast. Please wait a moment and try again.",
    });
    expect(prismaMock.notifications.createMany).not.toHaveBeenCalled();
  });
});

// --- Read-state actions --------------------------------------------------
describe("read-state actions scope to the caller", () => {
  it("marks a single notification read only for the recipient", async () => {
    mockSender.mockResolvedValue(asSender({ profileId: "u-9" }));
    prismaMock.notifications.updateMany.mockResolvedValue({ count: 1 });

    const res = await markNotificationRead("n-1");

    expect(res).toEqual({ success: true });
    const where = prismaMock.notifications.updateMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ id: "n-1", recipient_id: "u-9", status: "unread" });
  });

  it("mark-all is idempotent and scoped", async () => {
    mockSender.mockResolvedValue(asSender({ profileId: "u-9" }));
    prismaMock.notifications.updateMany.mockResolvedValue({ count: 3 });

    const res = await markAllNotificationsRead();

    expect(res).toEqual({ success: true, count: 3 });
    expect(prismaMock.notifications.updateMany.mock.calls[0][0].where).toMatchObject({
      recipient_id: "u-9",
      status: "unread",
    });
  });

  it("counts only the caller's unread rows", async () => {
    mockSender.mockResolvedValue(asSender({ profileId: "u-9" }));
    prismaMock.notifications.count.mockResolvedValue(4);

    const count = await getUnreadCount();

    expect(count).toBe(4);
    expect(prismaMock.notifications.count.mock.calls[0][0].where).toMatchObject({
      recipient_id: "u-9",
      status: "unread",
    });
  });
});
