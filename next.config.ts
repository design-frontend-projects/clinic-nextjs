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
const PRODUCTION_HOST = "rkkbqnzxzkhmn4gof16rwwbn.79.72.6.5.sslip.io";

function getConfiguredHost(): string | null {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).host;
  } catch {
    return null;
  }
}

const allowedServerActionOrigins = Array.from(
  new Set(
    [
      PRODUCTION_HOST,
      getConfiguredHost(),
      "localhost:4000",
      "localhost:4005",
    ].filter((origin): origin is string => Boolean(origin))
  )
);

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
  // Emit a self-contained server bundle (`.next/standalone/server.js`) so the
  // Docker runner stage stays slim (no full node_modules / `next start`).
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    serverActions: {
      allowedOrigins: allowedServerActionOrigins,
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: PRODUCTION_HOST,
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/storage/v1/object/**",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
  async redirects() {
    return UNPREFIXED_AUTH_ROUTES.map((route) => ({
      source: route,
      destination: `/${DEFAULT_LOCALE}${route}`,
      permanent: false,
    }));
  },
};

export default withSerwist(withNextIntl(nextConfig));
