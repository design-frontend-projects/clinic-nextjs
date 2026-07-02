import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const handleI18nRouting = createMiddleware(routing);

const publicRoutes = ["/", "/sign-in", "/sign-up", "/api/webhooks"];

export default async function middleware(request: NextRequest) {
  const response = handleI18nRouting(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(new RegExp(`^/(${routing.locales.join("|")})/?`));
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;

  const pathnameWithoutLocale = pathname.replace(new RegExp(`^/(${routing.locales.join("|")})/?`), "/") || "/";

  const isPublicRoute = publicRoutes.some(
    (route) =>
      pathnameWithoutLocale === route ||
      pathnameWithoutLocale.startsWith(`${route}/`)
  );

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
  const hasCompletedOnboarding = request.cookies.get("onboarding_complete")?.value === "1";

  if (user) {
    if (!hasCompletedOnboarding && !isOnboardingRoute && !isPublicRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/onboarding`;
      const redirectResponse = NextResponse.redirect(url);
      response.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value, cookie as any);
      });
      return redirectResponse;
    }

    if (hasCompletedOnboarding && isOnboardingRoute) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/admin`;
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

