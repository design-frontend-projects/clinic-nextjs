import { describe, expect, it, vi } from "vitest";
import {
  fetchTenantAccountSnapshot,
  resolveTenantOwnerAuthId,
} from "@/lib/tenant-subscription-snapshot";

const AUTH_ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "22222222-2222-4222-8222-222222222222";
const CLINIC_ID = "33333333-3333-4333-8333-333333333333";
const PLAN_ID = "44444444-4444-4444-8444-444444444444";
const SUB_ID = "55555555-5555-4555-8555-555555555555";

describe("tenant-subscription-snapshot", () => {
  it("queries profiles and tenant_subscriptions strictly by ownerAuthUserId and serializes Decimal/Date fields", async () => {
    const db = {
      profiles: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: PROFILE_ID,
          auth_user_id: AUTH_ID,
          tenant_id: CLINIC_ID,
          clinic_id: CLINIC_ID,
          branch_id: null,
          full_name: "Dr. Owner",
          email: "owner@clinic.com",
          phone: "+201001234567",
          specialty: null,
          role: "owner",
          is_owner: true,
          status: "active",
          is_profile_completed: true,
          created_at: new Date("2026-06-01T10:00:00.000Z"),
        }),
      },
      tenant_subscriptions: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: SUB_ID,
          tenant_id: AUTH_ID,
          plan_id: PLAN_ID,
          plan: {
            id: PLAN_ID,
            name: "Pro",
            billing_period: "monthly",
            price: { toString: () => "99.5", valueOf: () => 99.5 },
            currency: "USD",
          },
          start_date: new Date("2026-06-01T00:00:00.000Z"),
          end_date: new Date("2026-07-01T00:00:00.000Z"),
          renewal_date: null,
          activated_at: new Date("2026-06-01T00:00:00.000Z"),
          grace_period_days: 7,
          status: "active",
          billing_cycle: "monthly",
          price: { valueOf: () => 99.5 },
          discount: null,
          currency: "USD",
          payment_status: "paid",
          payment_reference: "TX-1",
          notes: null,
          created_at: new Date("2026-06-01T00:00:00.000Z"),
          updated_at: new Date("2026-06-01T00:00:00.000Z"),
        }),
      },
    };

    const snapshot = await fetchTenantAccountSnapshot(db, AUTH_ID);

    expect(db.profiles.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { auth_user_id: AUTH_ID } }),
    );
    expect(db.tenant_subscriptions.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenant_id: AUTH_ID } }),
    );
    expect(snapshot.profile).toEqual({
      id: PROFILE_ID,
      auth_user_id: AUTH_ID,
      tenant_id: CLINIC_ID,
      clinic_id: CLINIC_ID,
      branch_id: null,
      full_name: "Dr. Owner",
      email: "owner@clinic.com",
      phone: "+201001234567",
      specialty: null,
      role: "owner",
      is_owner: true,
      status: "active",
      is_profile_completed: true,
      created_at: "2026-06-01T10:00:00.000Z",
    });
    expect(snapshot.subscription).toEqual({
      id: SUB_ID,
      tenant_id: AUTH_ID,
      plan_id: PLAN_ID,
      plan: {
        id: PLAN_ID,
        name: "Pro",
        billing_period: "monthly",
        price: 99.5,
        currency: "USD",
      },
      start_date: "2026-06-01T00:00:00.000Z",
      end_date: "2026-07-01T00:00:00.000Z",
      renewal_date: null,
      activated_at: "2026-06-01T00:00:00.000Z",
      grace_period_days: 7,
      status: "active",
      billing_cycle: "monthly",
      price: 99.5,
      discount: null,
      currency: "USD",
      payment_status: "paid",
      payment_reference: "TX-1",
      notes: null,
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
    });
  });

  it("throws if the owner profile does not exist", async () => {
    const db = {
      profiles: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      tenant_subscriptions: { findUnique: vi.fn().mockResolvedValueOnce(null) },
    };

    await expect(fetchTenantAccountSnapshot(db, AUTH_ID)).rejects.toThrow(
      /Owner profile not found/,
    );
  });

  it("resolves owner auth_user_id from either auth_user_id or legacy clinic.id", async () => {
    const dbDirect = {
      profiles: {
        findUnique: vi.fn().mockResolvedValueOnce({
          id: PROFILE_ID,
          auth_user_id: AUTH_ID,
          role: "owner",
          is_owner: true,
        }),
      },
      clinics: { findUnique: vi.fn() },
    };

    await expect(resolveTenantOwnerAuthId(dbDirect, AUTH_ID)).resolves.toEqual({
      ownerAuthUserId: AUTH_ID,
      ownerProfileId: PROFILE_ID,
    });
    expect(dbDirect.clinics.findUnique).not.toHaveBeenCalled();

    const dbFallback = {
      profiles: { findUnique: vi.fn().mockResolvedValueOnce(null) },
      clinics: {
        findUnique: vi.fn().mockResolvedValueOnce({
          auth_user_id: AUTH_ID,
          staff_profiles: [{ id: PROFILE_ID, auth_user_id: AUTH_ID }],
        }),
      },
    };

    await expect(
      resolveTenantOwnerAuthId(dbFallback, CLINIC_ID),
    ).resolves.toEqual({
      ownerAuthUserId: AUTH_ID,
      ownerProfileId: PROFILE_ID,
    });
  });
});
