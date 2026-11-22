import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { routing } from "@/i18n/routing";

/**
 * Auth callback for OAuth code exchange and email links (invite / recovery /
 * signup confirmation). Uses a cookie-bound SSR client so the established
 * session is actually persisted, then forwards to `next` (e.g. the
 * set-password screen for invited users).
 */

/**
 * Resolve the public-facing origin behind a reverse proxy (e.g. Coolify/Traefik)
 * so redirects never leak the container's internal `0.0.0.0:4000` origin.
 */
function getPublicOrigin(request: Request): string {
  const { origin } = new URL(request.url);
  if (process.env.NODE_ENV === "development") {
    return origin;
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost) {
    const forwardedProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  const envKey = "NEXT_PUBLIC_SITE_URL";
  const configuredSiteUrl =
    process.env[envKey]?.trim() || process.env["SITE_URL"]?.trim();
  if (configuredSiteUrl) {
    return configuredSiteUrl.replace(/\/$/, "");
  }

  return origin;
}

/**
 * `next` is attacker-controlled input on a public route. Only accept a
 * same-origin path: a single leading slash (protocol-relative "//host"
 * URLs change the authority when resolved) and no backslashes.
 */
function isSafeNextPath(value: string | null): value is string {
  return Boolean(
    value &&
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !value.includes("\\"),
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = isSafeNextPath(rawNext) ? rawNext : "/";

  const cookieStore = await cookies();
  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  let exchangeError = false;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    exchangeError = Boolean(error);
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    exchangeError = Boolean(error);
  } else {
    exchangeError = true;
  }

  const publicOrigin = getPublicOrigin(request);

  if (!exchangeError) {
    return NextResponse.redirect(`${publicOrigin}${next}`);
  }

  // When a `next` target was provided (e.g. the reset-password page), send the
  // user back there with an error flag so the page can render an
  // invalid/expired-link state. Otherwise fall back to the sign-in screen.
  if (isSafeNextPath(rawNext)) {
    const errorUrl = new URL(rawNext, publicOrigin);
    errorUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(errorUrl);
  }
  return NextResponse.redirect(
    `${publicOrigin}/${routing.defaultLocale}/sign-in?error=auth_callback_failed`,
  );
}
