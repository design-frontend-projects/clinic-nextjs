/**
 * Centralized error handling.
 *
 * The codebase previously had no shared error helper — each action re-declared
 * its own `getErrorMessage` or returned hardcoded strings. This module is the
 * single place that turns arbitrary thrown values into safe, human-readable
 * messages for the UI, and gives the WhatsApp gateway a typed error surface.
 */

/** Machine-readable classes of failure surfaced by the WhatsApp gateway. */
export type WahaErrorCode =
  | "config" // gateway env vars missing / misconfigured
  | "unreachable" // network error / timeout talking to WAHA
  | "auth" // WAHA rejected the API key (401/403)
  | "session_not_connected" // no linked WhatsApp session (QR not scanned)
  | "invalid_number" // recipient phone can't be turned into a chat id
  | "gateway" // WAHA returned a non-2xx we don't specially handle
  | "unknown";

/** Human-readable copy for each gateway failure class. */
const WAHA_MESSAGES: Record<WahaErrorCode, string> = {
  config:
    "WhatsApp is not configured. Set WAHA_BASE_URL and WAHA_API_KEY, then restart the app.",
  unreachable:
    "The WhatsApp gateway is unreachable. Check that the WAHA container is running and reachable.",
  auth: "The WhatsApp gateway rejected the API key. Verify WAHA_API_KEY matches the gateway.",
  session_not_connected:
    "WhatsApp isn't connected yet. Open the WAHA dashboard and scan the QR code to link an account.",
  invalid_number: "This contact doesn't have a valid WhatsApp number.",
  gateway: "The WhatsApp gateway returned an error. Please try again in a moment.",
  unknown: "Something went wrong while sending the WhatsApp message.",
};

/** Typed error for all WAHA gateway failures. Carries a class + optional HTTP status. */
export class WahaError extends Error {
  readonly code: WahaErrorCode;
  readonly status?: number;

  constructor(code: WahaErrorCode, status?: number, message?: string) {
    super(message ?? WAHA_MESSAGES[code]);
    this.name = "WahaError";
    this.code = code;
    this.status = status;
  }
}

/** Safely narrow an unknown thrown value to a message string. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return "Unexpected error";
}

/**
 * Map any thrown value to a message safe to show a user. Known `WahaError`s use
 * their curated copy; everything else falls back to a generic message so raw
 * internals (stack traces, DB errors) never leak to the client.
 */
export function toHumanMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  if (error instanceof WahaError) return WAHA_MESSAGES[error.code];
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

/**
 * Standard server-action error envelope. Use in every action `catch` so the
 * client receives `{ error }` with a readable string instead of a thrown value.
 */
export function toActionError(
  error: unknown,
  fallback?: string,
): { error: string } {
  return { error: toHumanMessage(error, fallback) };
}
