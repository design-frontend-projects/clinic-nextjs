/**
 * Client-safe helpers for building `https://wa.me/...` deep links and
 * formatting temporary-password account credential messages.
 */

export type WhatsAppPhoneParseResult =
  | { status: "empty" }
  | { status: "valid"; digits: string }
  | { status: "missing_country_code" }
  | { status: "invalid" };

export type WhatsAppShareUrlResult =
  | { url: string; usedPhone: boolean }
  | { error: "missing_country_code" | "invalid" };

export interface TempPasswordShareMessageParams {
  greeting: string;
  intro: string;
  emailLabel: string;
  email?: string | null;
  passwordLabel: string;
  tempPassword: string;
  signInUrlLabel: string;
  signInUrl?: string | null;
  changePasswordNote: string;
}

/**
 * Parse and normalize a phone number for `https://wa.me/<digits>`.
 *
 * Rules (per WhatsApp Click-to-Chat / E.164):
 * - Blank/whitespace -> `"empty"` (caller can open `wa.me/?text=...` to pick a contact)
 * - Strips spaces, `+`, `-`, parentheses, and any non-digit characters
 * - Converts an international `00` prefix to bare country-code digits
 * - Requires 8–15 digits total
 * - Rejects a single leading `0` as `"missing_country_code"` (local format)
 */
export function parseWhatsAppPhone(
  raw: string | null | undefined,
): WhatsAppPhoneParseResult {
  const trimmed = (raw ?? "").trim();
  if (!trimmed) {
    return { status: "empty" };
  }

  const rawDigits = trimmed.replace(/\D/g, "");
  if (!rawDigits) {
    return { status: "invalid" };
  }

  const hadDoubleZeroPrefix = rawDigits.startsWith("00");
  const digits = hadDoubleZeroPrefix ? rawDigits.slice(2) : rawDigits;

  if (digits.length < 8 || digits.length > 15) {
    return { status: "invalid" };
  }

  if (digits.startsWith("0")) {
    return hadDoubleZeroPrefix
      ? { status: "invalid" }
      : { status: "missing_country_code" };
  }

  return { status: "valid", digits };
}

/**
 * Build a `https://wa.me/...` Click-to-Chat URL with URL-encoded message text.
 * When `phone` is blank, returns `https://wa.me/?text=...` so the user can
 * choose a contact inside WhatsApp.
 */
export function buildWhatsAppShareUrl(params: {
  phone?: string | null;
  text: string;
}): WhatsAppShareUrlResult {
  const parsed = parseWhatsAppPhone(params.phone);
  const encodedText = encodeURIComponent(params.text);

  if (parsed.status === "empty") {
    return {
      url: `https://wa.me/?text=${encodedText}`,
      usedPhone: false,
    };
  }

  if (parsed.status === "valid") {
    return {
      url: `https://wa.me/${parsed.digits}?text=${encodedText}`,
      usedPhone: true,
    };
  }

  return { error: parsed.status };
}

/**
 * Format a clean plain-text message carrying temporary sign-in credentials.
 * The password is kept unadorned (no markdown/backticks) so copying it from
 * WhatsApp never introduces stray characters.
 */
export function buildTempPasswordShareMessage(
  params: TempPasswordShareMessageParams,
): string {
  const detailLines: string[] = [];

  if (params.email?.trim()) {
    detailLines.push(`${params.emailLabel} ${params.email.trim()}`);
  }
  detailLines.push(`${params.passwordLabel} ${params.tempPassword}`);
  if (params.signInUrl?.trim()) {
    detailLines.push(`${params.signInUrlLabel} ${params.signInUrl.trim()}`);
  }

  return [
    params.greeting,
    "",
    params.intro,
    "",
    ...detailLines,
    "",
    params.changePasswordNote,
  ].join("\n");
}
