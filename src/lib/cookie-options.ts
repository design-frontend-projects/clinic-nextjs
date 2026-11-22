import { headers } from "next/headers";

/**
 * Determine whether cookies set from a Server Action / Route Handler should
 * carry the `Secure` attribute.
 *
 * Checking `process.env.NODE_ENV === "production"` alone breaks plain-HTTP
 * production/staging deployments (e.g. Coolify `http://*.sslip.io`), because
 * browsers silently drop `Secure` cookies over non-HTTPS origins. Instead,
 * inspect the actual request protocol (`x-forwarded-proto`, `origin`, or
 * `referer`), falling back to `NEXT_PUBLIC_SITE_URL` when headers are absent.
 */
export async function isSecureCookieContext(): Promise<boolean> {
  try {
    const headerStore = await headers();
    const forwardedProto = headerStore
      .get("x-forwarded-proto")
      ?.split(",")[0]
      ?.trim()
      .toLowerCase();
    if (forwardedProto === "https") return true;
    if (forwardedProto === "http") return false;

    const origin = headerStore.get("origin") || headerStore.get("referer");
    if (origin) {
      return origin.toLowerCase().startsWith("https://");
    }
  } catch {
    // `headers()` is unavailable outside a request context (e.g. unit tests).
  }

  const siteUrl =
    process.env["NEXT_PUBLIC_SITE_URL"]?.trim() ||
    process.env["SITE_URL"]?.trim();
  if (siteUrl) {
    return siteUrl.toLowerCase().startsWith("https://");
  }

  return process.env.NODE_ENV === "production";
}
