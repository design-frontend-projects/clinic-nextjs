import { describe, it, expect } from "vitest";
import {
  maskEmailAddress,
  signPendingPhoneToken,
  splitFullName,
  verifyPendingPhoneToken,
} from "../phone-otp";

const SECRET = "test-phone-otp-signing-secret-0123456789";

describe("phone-otp token signing and verification", () => {
  const basePayload = {
    uid: "auth-user-1",
    pid: "profile-1",
    phone: "+201001234567",
    exp: 2_000_000_000_000,
  };

  it("verifies a validly signed token matching uid, pid, and phone", () => {
    const token = signPendingPhoneToken(basePayload, SECRET);
    const result = verifyPendingPhoneToken(
      token,
      {
        uid: basePayload.uid,
        pid: basePayload.pid,
        phone: basePayload.phone,
      },
      SECRET,
      1_900_000_000_000,
    );

    expect(result).toEqual({ valid: true, payload: basePayload });
  });

  it("rejects a token with a tampered payload", () => {
    const token = signPendingPhoneToken(basePayload, SECRET);
    const [, sig] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...basePayload, phone: "+201999999999" }),
      "utf8",
    ).toString("base64url");

    const result = verifyPendingPhoneToken(
      `${tamperedPayload}.${sig}`,
      {
        uid: basePayload.uid,
        pid: basePayload.pid,
        phone: "+201999999999",
      },
      SECRET,
      1_900_000_000_000,
    );

    expect(result).toEqual({ valid: false, reason: "invalid_signature" });
  });

  it("rejects a token verified with the wrong secret", () => {
    const token = signPendingPhoneToken(basePayload, SECRET);
    const result = verifyPendingPhoneToken(
      token,
      {
        uid: basePayload.uid,
        pid: basePayload.pid,
        phone: basePayload.phone,
      },
      "different-secret",
      1_900_000_000_000,
    );

    expect(result).toEqual({ valid: false, reason: "invalid_signature" });
  });

  it("rejects an expired token", () => {
    const token = signPendingPhoneToken(basePayload, SECRET);
    const result = verifyPendingPhoneToken(
      token,
      {
        uid: basePayload.uid,
        pid: basePayload.pid,
        phone: basePayload.phone,
      },
      SECRET,
      basePayload.exp + 1,
    );

    expect(result).toEqual({ valid: false, reason: "expired" });
  });

  it("rejects a token when phone, uid, or pid does not match", () => {
    const token = signPendingPhoneToken(basePayload, SECRET);

    expect(
      verifyPendingPhoneToken(
        token,
        { uid: basePayload.uid, pid: basePayload.pid, phone: "+201111111111" },
        SECRET,
        1_900_000_000_000,
      ),
    ).toEqual({ valid: false, reason: "mismatch" });

    expect(
      verifyPendingPhoneToken(
        token,
        { uid: "other-user", pid: basePayload.pid, phone: basePayload.phone },
        SECRET,
        1_900_000_000_000,
      ),
    ).toEqual({ valid: false, reason: "mismatch" });

    expect(
      verifyPendingPhoneToken(
        token,
        { uid: basePayload.uid, pid: "other-profile", phone: basePayload.phone },
        SECRET,
        1_900_000_000_000,
      ),
    ).toEqual({ valid: false, reason: "mismatch" });
  });

  it("rejects malformed tokens", () => {
    expect(
      verifyPendingPhoneToken(
        "not-a-valid-token",
        { uid: "a", pid: "b", phone: "123456" },
        SECRET,
      ),
    ).toEqual({ valid: false, reason: "malformed" });
  });
});

describe("maskEmailAddress", () => {
  it("masks the middle characters of standard local parts", () => {
    expect(maskEmailAddress("doctor@clinic.com")).toBe("d***r@clinic.com");
  });

  it("masks short local parts safely", () => {
    expect(maskEmailAddress("ab@clinic.com")).toBe("a***@clinic.com");
    expect(maskEmailAddress("a@clinic.com")).toBe("a***@clinic.com");
  });
});

describe("splitFullName", () => {
  it("splits multi-word names into first_name and last_name", () => {
    expect(splitFullName("  Sara   Ahmed Hassan  ")).toEqual({
      first_name: "Sara",
      last_name: "Ahmed Hassan",
    });
  });

  it("handles single-word names", () => {
    expect(splitFullName("Mona")).toEqual({
      first_name: "Mona",
      last_name: "",
    });
  });
});
