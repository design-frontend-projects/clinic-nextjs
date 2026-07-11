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

const nextConfig: NextConfig = {
  // other existing config options can be added here if needed
};

export default withSerwist(withNextIntl(nextConfig));
