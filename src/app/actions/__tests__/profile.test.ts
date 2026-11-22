import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockGetSupabaseSession,
  mockRequireAuthenticatedTenant,
  mockCookieGet,
  mockCookieSet,
  mockCookieDelete,
  mockRevalidatePath,
  mockSignInWithOtp,
  mockVerifyOtp,
  mockAdminUpdateUserById,
  mockFindClinicDuplicate,
  mockPrismaProfilesFindUnique,
  mockPrismaProfilesUpdate,
  mockPrismaPatientsFindFirst,
  mockPrismaPatientsUpdate,
  mockPrismaAuditCreate,
  mockPrismaTransaction,
} = vi.hoisted(() => ({
  mockGetSupabaseSession: vi.fn(),
  mockRequireAuthenticatedTenant: vi.fn(),
  mockCookieGet: vi.fn(),
  mockCookieSet: vi.fn(),
  mockCookieDelete: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockSignInWithOtp: vi.fn(),
  mockVerifyOtp: vi.fn(),
  mockAdminUpdateUserById: vi.fn(),
  mockFindClinicDuplicate: vi.fn(),
  mockPrismaProfilesFindUnique: vi.fn(),
  mockPrismaProfilesUpdate: vi.fn(),
  mockPrismaPatientsFindFirst: vi.fn(),
  mockPrismaPatientsUpdate: vi.fn(),
  mockPrismaAuditCreate: vi.fn(),
  mockPrismaTransaction: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getSupabaseSession: mockGetSupabaseSession,
  requireAuthenticatedTenant: mockRequireAuthenticatedTenant,
  requireTenantInfo: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
    set: mockCookieSet,
    delete: mockCookieDelete,
    getAll: () => [],
  })),
  headers: vi.fn(async () => ({
    get: () => "https",
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      signInWithOtp: mockSignInWithOtp,
      verifyOtp: mockVerifyOtp,
    },
  })),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({
    url: "https://example.supabase.co",
    anonKey: "anon-key-test",
  }),
  getSupabaseServiceKey: () => "service-role-secret-test",
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: {
      admin: {
        updateUserById: mockAdminUpdateUserById,
      },
    },
  }),
}));

vi.mock("@/lib/user-creation", () => ({
  findClinicDuplicate: mockFindClinicDuplicate,
  duplicateMessage: (match: { field: string; source: string }) =>
    `A ${match.source === "patients" ? "patient" : "user"} with this ${match.field} already exists in this clinic.`,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profiles: {
      findUnique: mockPrismaProfilesFindUnique,
      update: mockPrismaProfilesUpdate,
    },
    patients: {
      findFirst: mockPrismaPatientsFindFirst,
      update: mockPrismaPatientsUpdate,
    },
    audit_logs: {
      create: mockPrismaAuditCreate,
    },
    $transaction: mockPrismaTransaction,
  },
}));

import {
  cancelPhoneChangeOtp,
  requestPhoneChangeOtp,
  updateMyProfileDetails,
  verifyPhoneChangeOtp,
} from "../profile";
import {
  PENDING_PHONE_COOKIE_NAME,
  signPendingPhoneToken,
} from "@/lib/phone-otp";

const SESSION = {
  user: {
    id: "auth-uid-1",
    email: "doctor@clinic.com",
    user_metadata: { existing: true },
  },
};

const TENANT = {
  userId: "auth-uid-1",
  profileId: "profile-id-1",
  clinicId: "clinic-id-1",
  clinicName: "Sunrise Clinic",
  role: "doctor",
  fullName: "Dr. Old Name",
  email: "doctor@clinic.com",
};

describe("profile server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSupabaseSession.mockResolvedValue(SESSION);
    mockRequireAuthenticatedTenant.mockResolvedValue(TENANT);
    mockFindClinicDuplicate.mockResolvedValue(null);
    mockAdminUpdateUserById.mockResolvedValue({ data: {}, error: null });
    mockPrismaAuditCreate.mockResolvedValue({});
    mockPrismaTransaction.mockImplementation(
      async (fn: (tx: unknown) => Promise<void>) => {
        await fn({
          profiles: { update: mockPrismaProfilesUpdate },
          patients: { update: mockPrismaPatientsUpdate },
        });
      },
    );
  });

  describe("updateMyProfileDetails", () => {
    it("updates profiles.full_name, syncs patient name + Supabase metadata, and writes audit log", async () => {
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({
        full_name: "Old Name",
        email: "doctor@clinic.com",
      });
      mockPrismaPatientsFindFirst.mockResolvedValueOnce({ id: "patient-id-1" });

      const result = await updateMyProfileDetails({
        full_name: "  New Full Name  ",
      });

      expect(result).toEqual({ success: true, full_name: "New Full Name" });
      expect(mockPrismaProfilesUpdate).toHaveBeenCalledWith({
        where: { id: "profile-id-1" },
        data: { full_name: "New Full Name" },
      });
      expect(mockPrismaPatientsUpdate).toHaveBeenCalledWith({
        where: { id: "patient-id-1" },
        data: { first_name: "New", last_name: "Full Name" },
      });
      expect(mockAdminUpdateUserById).toHaveBeenCalledWith("auth-uid-1", {
        user_metadata: { existing: true, full_name: "New Full Name" },
      });
      expect(mockPrismaAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenant_id: "clinic-id-1",
            action: "profile.updated",
            entity_id: "profile-id-1",
          }),
        }),
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
    });

    it("rejects names shorter than 2 characters", async () => {
      const result = await updateMyProfileDetails({ full_name: "A" });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("validation_error");
      }
      expect(mockPrismaProfilesUpdate).not.toHaveBeenCalled();
    });
  });

  describe("requestPhoneChangeOtp", () => {
    it("sends Supabase email OTP to authoritative registered email and sets signed HttpOnly cookie", async () => {
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({
        phone: "+201000000000",
      });
      mockPrismaPatientsFindFirst.mockResolvedValueOnce(null);
      mockSignInWithOtp.mockResolvedValueOnce({ data: {}, error: null });

      const result = await requestPhoneChangeOtp({
        newPhone: "+201001234567",
      });

      expect(result).toEqual({
        success: true,
        maskedEmail: "d***r@clinic.com",
        expiresInSeconds: 600,
      });
      expect(mockFindClinicDuplicate).toHaveBeenCalledWith({
        clinicId: "clinic-id-1",
        phone: "+201001234567",
        excludeProfileId: "profile-id-1",
        excludePatientId: undefined,
      });
      expect(mockSignInWithOtp).toHaveBeenCalledWith({
        email: "doctor@clinic.com",
        options: { shouldCreateUser: false },
      });
      expect(mockCookieSet).toHaveBeenCalledWith(
        PENDING_PHONE_COOKIE_NAME,
        expect.any(String),
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "lax",
          path: "/",
          maxAge: 600,
        }),
      );
    });

    it("blocks duplicate clinic phones before sending an OTP", async () => {
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({
        phone: "+201000000000",
      });
      mockPrismaPatientsFindFirst.mockResolvedValueOnce(null);
      mockFindClinicDuplicate.mockResolvedValueOnce({
        field: "phone",
        source: "profiles",
      });

      const result = await requestPhoneChangeOtp({
        newPhone: "+201001234567",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("duplicate_phone");
      }
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
      expect(mockCookieSet).not.toHaveBeenCalled();
    });

    it("blocks requesting an OTP when the phone has not changed", async () => {
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({
        phone: "+201001234567",
      });

      const result = await requestPhoneChangeOtp({
        newPhone: "+201001234567",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("same_phone");
      }
      expect(mockSignInWithOtp).not.toHaveBeenCalled();
    });

    it("surfaces Supabase rate limiting with rate_limited error code", async () => {
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({ phone: null });
      mockPrismaPatientsFindFirst.mockResolvedValueOnce(null);
      mockSignInWithOtp.mockResolvedValueOnce({
        data: {},
        error: {
          code: "over_email_send_rate_limit",
          status: 429,
          message: "For security purposes, you can only request this after 60 seconds.",
        },
      });

      const result = await requestPhoneChangeOtp({
        newPhone: "+201001234567",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("rate_limited");
      }
    });
  });

  describe("verifyPhoneChangeOtp", () => {
    it("commits phone update to profiles + patients + audit_logs after valid Supabase OTP verification", async () => {
      const signedToken = signPendingPhoneToken(
        {
          uid: "auth-uid-1",
          pid: "profile-id-1",
          phone: "+201001234567",
          exp: Date.now() + 60_000,
        },
        "service-role-secret-test",
      );
      mockCookieGet.mockReturnValueOnce({ value: signedToken });
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: { id: "auth-uid-1" } },
        error: null,
      });
      mockPrismaProfilesFindUnique.mockResolvedValueOnce({
        phone: "+201000000000",
      });
      mockPrismaPatientsFindFirst.mockResolvedValueOnce({ id: "patient-id-1" });

      const result = await verifyPhoneChangeOtp({
        newPhone: "+201001234567",
        otp: "123456",
      });

      expect(result).toEqual({ success: true, phone: "+201001234567" });
      expect(mockVerifyOtp).toHaveBeenCalledWith({
        email: "doctor@clinic.com",
        token: "123456",
        type: "email",
      });
      expect(mockPrismaProfilesUpdate).toHaveBeenCalledWith({
        where: { id: "profile-id-1" },
        data: { phone: "+201001234567" },
      });
      expect(mockPrismaPatientsUpdate).toHaveBeenCalledWith({
        where: { id: "patient-id-1" },
        data: { phone: "+201001234567" },
      });
      expect(mockPrismaAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: "profile.phone_updated",
            new_values: {
              phone: "+201001234567",
              verified_via: "supabase_email_otp",
            },
          }),
        }),
      );
      expect(mockCookieDelete).toHaveBeenCalledWith(PENDING_PHONE_COOKIE_NAME);
      expect(mockRevalidatePath).toHaveBeenCalledWith("/profile");
    });

    it("rejects verification when the signed pending cookie is missing", async () => {
      mockCookieGet.mockReturnValueOnce(undefined);

      const result = await verifyPhoneChangeOtp({
        newPhone: "+201001234567",
        otp: "123456",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("otp_expired");
      }
      expect(mockVerifyOtp).not.toHaveBeenCalled();
      expect(mockPrismaProfilesUpdate).not.toHaveBeenCalled();
    });

    it("rejects verification when Supabase verifyOtp fails and does NOT update phone", async () => {
      const signedToken = signPendingPhoneToken(
        {
          uid: "auth-uid-1",
          pid: "profile-id-1",
          phone: "+201001234567",
          exp: Date.now() + 60_000,
        },
        "service-role-secret-test",
      );
      mockCookieGet.mockReturnValueOnce({ value: signedToken });
      mockVerifyOtp.mockResolvedValueOnce({
        data: { user: null },
        error: { message: "Token has expired or is invalid", code: "otp_expired" },
      });

      const result = await verifyPhoneChangeOtp({
        newPhone: "+201001234567",
        otp: "000000",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("otp_expired");
      }
      expect(mockPrismaProfilesUpdate).not.toHaveBeenCalled();
    });

    it("rejects verification when pending phone cookie was signed for a different phone", async () => {
      const signedToken = signPendingPhoneToken(
        {
          uid: "auth-uid-1",
          pid: "profile-id-1",
          phone: "+201009999999",
          exp: Date.now() + 60_000,
        },
        "service-role-secret-test",
      );
      mockCookieGet.mockReturnValueOnce({ value: signedToken });

      const result = await verifyPhoneChangeOtp({
        newPhone: "+201001234567",
        otp: "123456",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("invalid_pending_request");
      }
      expect(mockVerifyOtp).not.toHaveBeenCalled();
    });
  });

  describe("cancelPhoneChangeOtp", () => {
    it("clears the pending phone cookie", async () => {
      const result = await cancelPhoneChangeOtp();
      expect(result).toEqual({ success: true });
      expect(mockCookieDelete).toHaveBeenCalledWith(PENDING_PHONE_COOKIE_NAME);
    });
  });
});
