import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest (allowlisted by the src/proxy.ts matcher).
// Lives at the app root (not under [locale]) so it is locale-independent; the
// start_url points at the default-locale dashboard since there is no
// locale-less landing route.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ClinicPro - Clinic Management System",
    short_name: "ClinicPro",
    description:
      "Multi-tenant clinic management for doctors, staff, and patients — works offline.",
    start_url: "/en/admin",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f172a",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
