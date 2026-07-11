import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Auth callback for OAuth code exchange and email links (invite / recovery /
 * signup confirmation). Uses a cookie-bound SSR client so the established
 * session is actually persisted, then forwards to `next` (e.g. the
 * set-password screen for invited users).
 */

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
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const rawNext = searchParams.get("next");
  const next = isSafeNextPath(rawNext) ? rawNext : "/";

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  if (!exchangeError) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    if (isLocalEnv) {
      return NextResponse.redirect(`${origin}${next}`);
    } else if (forwardedHost) {
      return NextResponse.redirect(`https://${forwardedHost}${next}`);
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  // When a `next` target was provided (e.g. the reset-password page), send the
  // user back there with an error flag so the page can render an
  // invalid/expired-link state. Otherwise fall back to the generic error URL.
  if (isSafeNextPath(rawNext)) {
    const errorUrl = new URL(rawNext, origin);
    errorUrl.searchParams.set("error", "auth_callback_failed");
    return NextResponse.redirect(errorUrl);
  }
  return NextResponse.redirect(`${origin}/auth/auth-code-error`);
}
