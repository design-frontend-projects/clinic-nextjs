"use client";

// Client-side locale swap: holds the active locale + messages in state and
// exchanges the message bundle in place on toggle — no navigation, no refresh,
// no redirect. The URL prefix is synced via history.replaceState so a later hard
// reload stays consistent (next-intl treats the URL prefix as authoritative).
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  NextIntlClientProvider,
  useLocale,
  type AbstractIntlMessages,
} from "next-intl";
import { Toaster } from "sonner";
import { routing } from "@/i18n/routing";

type AppLocale = (typeof routing.locales)[number];

interface LocaleSwitcherContextValue {
  locale: AppLocale;
  switchLocale: (next: AppLocale) => Promise<void>;
}

const LocaleSwitcherContext = createContext<LocaleSwitcherContextValue | null>(
  null
);

export function useLocaleSwitcher(): LocaleSwitcherContextValue {
  const context = useContext(LocaleSwitcherContext);
  if (!context) {
    throw new Error("useLocaleSwitcher must be used within <IntlProvider>");
  }
  return context;
}

// Lazy-load a message bundle on demand so we never ship both eagerly.
// Relative path (not the @/ alias) so webpack builds a static import context.
async function loadMessages(locale: AppLocale): Promise<AbstractIntlMessages> {
  const mod = await import(`../../messages/${locale}.json`);
  return mod.default as AbstractIntlMessages;
}

function isAppLocale(value: string): value is AppLocale {
  return (routing.locales as readonly string[]).includes(value);
}

function syncUrlPrefix(next: AppLocale): void {
  const { pathname, search, hash } = window.location;
  const localePattern = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);
  const nextPathname = localePattern.test(pathname)
    ? pathname.replace(localePattern, `/${next}`)
    : `/${next}${pathname}`;
  window.history.replaceState(null, "", `${nextPathname}${search}${hash}`);
}

interface IntlProviderProps {
  initialLocale: string;
  initialMessages: AbstractIntlMessages;
  children: ReactNode;
}

export function IntlProvider({
  initialLocale,
  initialMessages,
  children,
}: IntlProviderProps) {
  const [locale, setLocale] = useState<AppLocale>(
    isAppLocale(initialLocale) ? initialLocale : routing.defaultLocale
  );
  const [messages, setMessages] =
    useState<AbstractIntlMessages>(initialMessages);

  const switchLocale = useCallback(
    async (next: AppLocale) => {
      if (next === locale || !isAppLocale(next)) return;

      const nextMessages = await loadMessages(next);
      setMessages(nextMessages);
      setLocale(next);

      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
      syncUrlPrefix(next);
    },
    [locale]
  );

  const value = useMemo(
    () => ({ locale, switchLocale }),
    [locale, switchLocale]
  );

  return (
    <LocaleSwitcherContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </LocaleSwitcherContext.Provider>
  );
}

// Drives the toast side from the live locale so it flips with the language.
export function LocalizedToaster() {
  const locale = useLocale();
  return <Toaster position={locale === "ar" ? "top-left" : "top-right"} />;
}
