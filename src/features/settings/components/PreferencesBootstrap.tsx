"use client";

// Applies DB-persisted user preferences on load WITHOUT fighting the local
// runtime stores: the DB theme applies only when next-themes has no
// localStorage value yet, and the DB language only when no NEXT_LOCALE cookie
// exists (i.e. a fresh browser/device). Local choices always win afterwards.
import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/routing";

interface PreferencesBootstrapProps {
  /** Theme persisted at the user scope, or null when the user never set one. */
  theme: string | null;
  /** Language persisted at the user scope, or null when the user never set one. */
  language: string | null;
}

export function PreferencesBootstrap({ theme, language }: PreferencesBootstrapProps) {
  const { setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  useEffect(() => {
    if (theme && !window.localStorage.getItem("theme")) {
      setTheme(theme);
    }
  }, [theme, setTheme]);

  useEffect(() => {
    if (!language || language === locale) return;
    if (language !== "en" && language !== "ar") return;
    const hasLocaleCookie = document.cookie.split("; ").some((entry) => entry.startsWith("NEXT_LOCALE="));
    if (!hasLocaleCookie) {
      router.replace(pathname, { locale: language });
    }
  }, [language, locale, pathname, router]);

  return null;
}
