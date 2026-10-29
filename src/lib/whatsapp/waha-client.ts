/**
 * WAHA (WhatsApp HTTP API) gateway client.
 *
 * A thin, engine-agnostic wrapper over the WAHA REST API so the rest of the app
 * never touches `fetch`/status codes directly and can be swapped for another
 * provider later. All failures surface as a typed `WahaError` carrying a
 * human-readable class (see `src/lib/errors.ts`).
 *
 * Server-only: reads secrets from the environment. Never import into a client
 * component.
 */

import "server-only";
import { WahaError } from "@/lib/errors";

/** Resolved, validated gateway configuration. */
interface WahaConfig {
  baseUrl: string;
  apiKey: string;
  session: string;
}

/** Read + validate WAHA env. Throws a `config` WahaError if anything is missing. */
function getConfig(): WahaConfig {
  const baseUrl = process.env.WAHA_BASE_URL?.replace(/\/+$/, "");
  const apiKey = process.env.WAHA_API_KEY;
  const session = process.env.WAHA_SESSION || "default";
  if (!baseUrl || !apiKey) {
    throw new WahaError("config");
  }
  return { baseUrl, apiKey, session };
}

/** How long to wait on any single gateway call before treating it unreachable. */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Convert a raw stored phone number into a WAHA chat id (`<digits>@c.us`).
 *
 * Stored `phone` columns are free-form and nullable, so we strip everything but
 * digits and require a plausible international length (country code + number).
 * Throws `invalid_number` when the value can't be a WhatsApp contact.
 */
export function toChatId(phone: string | null | undefined): string {
  const digits = (phone ?? "").replace(/\D/g, "");
  // E.164 numbers are 8–15 digits including country code.
  if (digits.length < 8 || digits.length > 15) {
    throw new WahaError("invalid_number");
  }
  return `${digits}@c.us`;
}

/** Perform a gateway request with auth, timeout, and typed error mapping. */
async function request<T>(
  path: string,
  init: RequestInit,
  config: WahaConfig,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": config.apiKey,
        ...init.headers,
      },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    // Network error, DNS failure, or timeout abort.
    throw new WahaError("unreachable");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401 || res.status === 403) {
    throw new WahaError("auth", res.status);
  }
  if (!res.ok) {
    // A stopped/unlinked session commonly surfaces as 422/424 from WAHA.
    if (res.status === 422 || res.status === 424) {
      throw new WahaError("session_not_connected", res.status);
    }
    throw new WahaError("gateway", res.status);
  }

  // Some endpoints return empty bodies.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** WAHA session lifecycle states we care about. */
type SessionStatus = "STARTING" | "SCAN_QR_CODE" | "WORKING" | "FAILED" | "STOPPED" | string;

/** Fetch the current session status so callers can fail fast before sending. */
export async function getSessionStatus(): Promise<SessionStatus> {
  const config = getConfig();
  const data = await request<{ status?: SessionStatus }>(
    `/api/sessions/${encodeURIComponent(config.session)}`,
    { method: "GET" },
    config,
  );
  return data?.status ?? "STOPPED";
}

/** Throw `session_not_connected` unless the linked WhatsApp session is live. */
export async function assertSessionConnected(): Promise<void> {
  const status = await getSessionStatus();
  if (status !== "WORKING") {
    throw new WahaError("session_not_connected");
  }
}

/** Result of a single text send. */
export interface SendTextResult {
  /** WAHA message id (provider-scoped). */
  id: string;
}

/**
 * Send a plain-text WhatsApp message to one chat id.
 * `chatId` must already be normalized via `toChatId`.
 */
export async function sendText(params: {
  chatId: string;
  text: string;
}): Promise<SendTextResult> {
  const config = getConfig();
  const data = await request<{ id?: string | { _serialized?: string } }>(
    "/api/sendText",
    {
      method: "POST",
      body: JSON.stringify({
        session: config.session,
        chatId: params.chatId,
        text: params.text,
      }),
    },
    config,
  );

  // WAHA returns either a string id or an object with `_serialized`.
  const id =
    typeof data?.id === "string"
      ? data.id
      : (data?.id?._serialized ?? "");
  return { id };
}

/** Convenience: normalize a raw phone and send in one call. */
export async function sendTextToPhone(params: {
  phone: string | null | undefined;
  text: string;
}): Promise<SendTextResult> {
  const chatId = toChatId(params.phone);
  return sendText({ chatId, text: params.text });
}
