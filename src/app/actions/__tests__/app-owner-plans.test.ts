import { beforeEach, describe, expect, it, vi } from "vitest";

const PLAN_ID = "66666666-6666-4666-8666-666666666666";
const ADMIN_ID = "11111111-1111-4111-8111-111111111111";

const { mockRequireAppOwner, mockRevalidatePath, prismaMock } = vi.hoisted(
  () => ({
    mockRequireAppOwner: vi.fn(),
    mockRevalidatePath: vi.fn(),
    prismaMock: {
      subscription_plans: {
        findFirst: vi.fn(),
        update: vi.fn(),
      },
      tenant_subscriptions: {
        count: vi.fn(),
      },
    },
  }),
);

vi.mock("@/lib/app-owner-auth", () => ({
  requireAppOwner: mockRequireAppOwner,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: prismaMock,
}));

import { removeSubscriptionPlan } from "../app-owner/plans";

describe("removeSubscriptionPlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAppOwner.mockResolvedValue({
      id: ADMIN_ID,
      role: "app_owner",
    });
  });

  it("soft-deletes and archives an unused plan and revalidates plans + landing", async () => {
    prismaMock.subscription_plans.findFirst.mockResolvedValueOnce({
      id: PLAN_ID,
    });
    prismaMock.tenant_subscriptions.count.mockResolvedValueOnce(0);
    prismaMock.subscription_plans.update.mockResolvedValueOnce({
      id: PLAN_ID,
      status: "archived",
    });

    const result = await removeSubscriptionPlan(PLAN_ID);
    expect(result).toEqual({ success: true });
    expect(prismaMock.subscription_plans.update).toHaveBeenCalledWith({
      where: { id: PLAN_ID },
      data: {
        status: "archived",
        deleted_at: expect.any(Date),
        updated_by: ADMIN_ID,
      },
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith("/app-owner/plans");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/");
  });

  it("blocks removal when active/pending/suspended tenants subscribe to the plan", async () => {
    prismaMock.subscription_plans.findFirst.mockResolvedValueOnce({
      id: PLAN_ID,
    });
    prismaMock.tenant_subscriptions.count.mockResolvedValueOnce(2);

    const result = await removeSubscriptionPlan(PLAN_ID);
    expect(result).toEqual({
      error:
        "Cannot remove a subscription plan while tenants are subscribed to it. Reassign those tenants to another plan first.",
    });
    expect(prismaMock.subscription_plans.update).not.toHaveBeenCalled();
  });

  it("returns an error for invalid UUIDs or missing plans", async () => {
    const invalid = await removeSubscriptionPlan("not-a-uuid");
    expect(invalid).toEqual({ error: "Invalid subscription plan ID." });

    prismaMock.subscription_plans.findFirst.mockResolvedValueOnce(null);
    const missing = await removeSubscriptionPlan(PLAN_ID);
    expect(missing).toEqual({ error: "Subscription plan not found." });
    expect(prismaMock.subscription_plans.update).not.toHaveBeenCalled();
  });
});
