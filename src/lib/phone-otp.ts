import { createHmac, timingSafeEqual } from "node:crypto";
import { getSupabaseServiceKey } from "@/lib/supabase/env";

export const PENDING_PHONE_COOKIE_NAME = "pending_phone_change";
export const PENDING_PHONE_TTL_SECONDS = 600; // 10 minutes
const TOKEN_DOMAIN_PREFIX = "phone-change-otp:v1:";

export interface PendingPhoneChangePayload {
  uid: string;
  pid: string;
  phone: string;
  exp: number;
}

export type VerifyPendingPhoneResult =
  | { valid: true; payload: PendingPhoneChangePayload }
  | {
      valid: false;
      reason: "malformed" | "invalid_signature" | "expired" | "mismatch";
    };

function resolveSigningSecret(secretOverride?: string): string {
  if (secretOverride && secretOverride.trim().length > 0) {
    return secretOverride.trim();
  }
  const configured = process.env["PHONE_OTP_SECRET"]?.trim();
  if (configured) {
    return configured;
  }
  return getSupabaseServiceKey();
}

function computeSignature(payloadB64: string, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${TOKEN_DOMAIN_PREFIX}${payloadB64}`)
    .digest("base64url");
}

/**
 * Create an HMAC-SHA256 signed token binding a pending phone number change to
 * a specific authenticated user, profile, and expiry timestamp.
 */
export function signPendingPhoneToken(
  payload: PendingPhoneChangePayload,
  secretOverride?: string,
): string {
  const secret = resolveSigningSecret(secretOverride);
  const payloadB64 = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const signature = computeSignature(payloadB64, secret);
  return `${payloadB64}.${signature}`;
}

/**
 * Verify a signed pending-phone token in constant time and validate ownership,
 * requested phone number, and expiration.
 */
export function verifyPendingPhoneToken(
  token: string,
  expected: { uid: string; pid: string; phone: string },
  secretOverride?: string,
  nowMs: number = Date.now(),
): VerifyPendingPhoneResult {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return { valid: false, reason: "malformed" };
  }

  const [payloadB64, providedSig] = parts;
  const secret = resolveSigningSecret(secretOverride);
  const expectedSig = computeSignature(payloadB64, secret);

  const providedBuf = Buffer.from(providedSig, "utf8");
  const expectedBuf = Buffer.from(expectedSig, "utf8");
  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return { valid: false, reason: "invalid_signature" };
  }

  let parsed: unknown;
  try {
    const json = Buffer.from(payloadB64, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    typeof (parsed as PendingPhoneChangePayload).uid !== "string" ||
    typeof (parsed as PendingPhoneChangePayload).pid !== "string" ||
    typeof (parsed as PendingPhoneChangePayload).phone !== "string" ||
    typeof (parsed as PendingPhoneChangePayload).exp !== "number"
  ) {
    return { valid: false, reason: "malformed" };
  }

  const payload = parsed as PendingPhoneChangePayload;
  if (payload.exp <= nowMs) {
    return { valid: false, reason: "expired" };
  }

  if (
    payload.uid !== expected.uid ||
    payload.pid !== expected.pid ||
    payload.phone !== expected.phone
  ) {
    return { valid: false, reason: "mismatch" };
  }

  return { valid: true, payload };
}

/**
 * Mask an email address for UI feedback (e.g. "j***n@clinic.com").
 */
export function maskEmailAddress(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return trimmed;

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

/**
 * Split a full name into first and last name segments for syncing linked
 * `patients` records when a patient updates their profile name.
 */
export function splitFullName(fullName: string): {
  first_name: string;
  last_name: string;
} {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { first_name: "", last_name: "" };
  }
  if (parts.length === 1) {
    return { first_name: parts[0], last_name: "" };
  }
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" "),
  };
}
