import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
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
};

import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";

export default async function RootLayout({
  children,
}: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = (await import(`../../messages/${locale}.json`)).default;
  return (
    <html lang={locale} suppressHydrationWarning className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <ThemeProvider>
            <QueryProvider>
              {children}
              <Toaster position="top-right" />
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}