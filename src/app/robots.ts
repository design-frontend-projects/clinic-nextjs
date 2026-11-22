import type { MetadataRoute } from "next";

const DEFAULT_SITE_URL = "https://rkkbqnzxzkhmn4gof16rwwbn.79.72.6.5.sslip.io";

function getSiteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  return raw.replace(/\/$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/*/admin",
          "/*/doctor",
          "/*/staff",
          "/*/patient",
          "/*/pharmacy",
          "/*/app-owner",
          "/*/settings",
          "/*/onboarding",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
