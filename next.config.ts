import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // App Router does not use Next.js' built-in i18n, but if keeping for Pages router:
  i18n: {
    locales: ["en", "ar"],
    defaultLocale: "en",
  },
  // other existing config options can be added here if needed
};

export default withNextIntl(nextConfig);
