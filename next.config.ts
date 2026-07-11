import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin();

// Serwist's webpack plugin runs only in the production `build` (which uses
// `next build --webpack`); dev stays on Turbopack with the SW disabled, so the
// "Turbopack not supported" notice is expected — silence it.
process.env.SERWIST_SUPPRESS_TURBOPACK_WARNING = "1";

// PWA service worker (Serwist). Composed AROUND next-intl. The SW itself is
// authored in src/app/sw.ts and emitted to public/sw.js. Disabled in dev to
// avoid churn against the RSC dev server; we manage online state ourselves.
const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
});

// Must match routing.defaultLocale in src/i18n/routing.ts.
const DEFAULT_LOCALE = "en";

// All pages live under the [locale] segment and there is no i18n middleware,
// so unprefixed auth URLs (typed directly, bookmarked, or from external
// links/emails) would otherwise be swallowed by [locale] and render the
// landing page. Send them to the default-locale route; query params (e.g.
// ?error= on reset-password) are preserved automatically.
const UNPREFIXED_AUTH_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/onboarding",
];

const nextConfig: NextConfig = {
  async redirects() {
    return UNPREFIXED_AUTH_ROUTES.map((route) => ({
      source: route,
      destination: `/${DEFAULT_LOCALE}${route}`,
      permanent: false,
    }));
  },
};

export default withSerwist(withNextIntl(nextConfig));
