import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ServiceWorkerProvider } from "@/components/providers/service-worker-provider";
import { OnlineProvider } from "@/components/providers/online-provider";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
});

export const metadata: Metadata = {
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
  themeColor: "#0f172a",
};

import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ServiceWorkerProvider />
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem={false}
            disableTransitionOnChange
          >
            <QueryProvider>
              <OnlineProvider />
              {children}
              <Toaster position={locale === "ar" ? "top-left" : "top-right"} />
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
