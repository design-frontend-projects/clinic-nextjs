import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { OnlineProvider } from "@/components/providers/online-provider";
import {
  IntlProvider,
  LocalizedToaster,
} from "@/components/providers/intl-provider";
import { ThemeProvider } from "next-themes";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--",
  display: "swap",
  preload: true,
});

const ibmPlexSansArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
  preload: true,
});

const DEFAULT_SITE_URL = "https://rkkbqnzxzkhmn4gof16rwwbn.79.72.6.5.sslip.io";

function getMetadataBase(): URL {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim() || DEFAULT_SITE_URL;
  try {
    return new URL(raw);
  } catch {
    return new URL(DEFAULT_SITE_URL);
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "ClinicPro - Clinic Management System",
  description:
    "Production-grade multi-tenant clinic management SaaS for doctors, staff, and patients.",
  robots: { index: true, follow: true },
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "ClinicPro" },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon-180.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

import { getLocale } from "next-intl/server";
import { getPublicSupabaseEnv } from "@/lib/supabase/env";

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getPublicSupabaseEnv();
  const publicEnvScript = `window.__PUBLIC_ENV__=${JSON.stringify({
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  }).replace(/</g, "\\u003c")};`;
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: publicEnvScript }} />
      </head>
      <body className={`${inter.variable} ${ibmPlexSansArabic.variable} font-sans antialiased`}>
        <ServiceWorkerProvider />
        <IntlProvider initialLocale={locale} initialMessages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <QueryProvider>
              <OnlineProvider />
              {children}
              <LocalizedToaster />
            </QueryProvider>
          </ThemeProvider>
        </IntlProvider>
      </body>
    </html>
  );
}
