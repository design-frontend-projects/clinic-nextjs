import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { getSupabaseEnv } from "./lib/supabase/env";

const handleI18nRouting = createMiddleware(routing);

const publicRoutes = [
  "/",
  "/sign-in",
  "/sign-up",
  "/request-status",
  "/forgot-password",
  "/reset-password",
  "/offline",
  "/api/webhooks",
];

export default async function middleware(request: NextRequest) {
  // Health probes, SEO metadata files, and the Supabase auth callback live
  // outside the [locale] tree and must not be locale-redirected or auth-gated.
  if (
    request.nextUrl.pathname === "/api/health" ||
    request.nextUrl.pathname.startsWith("/api/sync/") ||
    request.nextUrl.pathname === "/robots.txt" ||
    request.nextUrl.pathname === "/sitemap.xml" ||
    request.nextUrl.pathname.startsWith("/auth/")
  ) {
    return NextResponse.next();
  }

  const response = handleI18nRouting(request);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})/?`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  const pathnameWithoutLocale = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})/?`), "/") || "/";

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathnameWithoutLocale === route ||
      pathnameWithoutLocale.startsWith(`${route}/`)
  );

  const hasSupabaseCookie = request.cookies
    .getAll()
    .some(({ name }) => name.startsWith("sb-"));
  const isServerAction = request.headers.has("next-action");

  // Public routes never redirect based on `user`. Skip the Supabase Auth
  // round-trip on public routes when there is no auth cookie to refresh/purge
  // OR when a Server Action (e.g. `completeSignIn`, `signUpAction`) is being
  // invoked — those actions already verify auth themselves.
  const shouldCheckAuth =
    !isPublicRoute || (hasSupabaseCookie && !isServerAction);

  let user: { id: string } | null = null;
  if (shouldCheckAuth) {
    try {
      const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseEnv();

      const supabase = createServerClient(
        supabaseUrl,
        supabaseAnonKey,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              );
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              );
            },
          },
        }
      );

      const { data, error: authError } = await supabase.auth.getUser();
      user = data.user;

      // If the browser carries a stale JWT for a deleted/missing user (e.g. after
      // DB reset or user deletion), purge the dead Supabase auth cookies so every
      // subsequent request stops triggering 403 `user_not_found`.
      if (
        authError &&
        (authError.code === "user_not_found" || authError.status === 403)
      ) {
        request.cookies.getAll().forEach(({ name }) => {
          if (name.startsWith("sb-") || name === "onboarding_complete") {
            response.cookies.delete(name);
          }
        });
      }
    } catch (error) {
      // Never fail public routes (e.g. /ar/sign-in) with an unhandled 500 when
      // Supabase auth check throws due to a transient network/config error.
      console.error("[proxy] Supabase auth check failed:", error);
    }
  }

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/sign-in`;
    const redirectResponse = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
    });
    return redirectResponse;
  }

  const isOnboardingRoute = pathnameWithoutLocale.startsWith("/onboarding");
  const isAppOwnerRoute =
    pathnameWithoutLocale === "/app-owner" ||
    pathnameWithoutLocale.startsWith("/app-owner/");
  const hasCompletedOnboarding = request.cookies.get("onboarding_complete")?.value === "1";

  if (user) {
    if (
      !hasCompletedOnboarding &&
      !isOnboardingRoute &&
      !isPublicRoute &&
      !isAppOwnerRoute
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/onboarding`;
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
      });
      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};

