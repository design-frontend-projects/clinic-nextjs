"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Moon, Sun, Globe, ArrowRight, Compass } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "@/i18n/routing";
import { useLocaleSwitcher } from "@/components/providers/intl-provider";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { ResolvedNavItem } from "@/components/layout/nav.config";

export const OPEN_COMMAND_PALETTE_EVENT = "clinicpro:open-command-palette";

export function openCommandPalette() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_COMMAND_PALETTE_EVENT));
  }
}

type CommandPaletteProps = {
  items: ResolvedNavItem[];
};

export function CommandPalette({ items }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { setTheme } = useTheme();
  const locale = useLocale();
  const { switchLocale } = useLocaleSwitcher();
  const t = useTranslations();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    const onCustomOpen = () => setOpen(true);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, onCustomOpen);
    };
  }, []);

  const runAndClose = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        showCloseButton={false}
        className="overflow-hidden p-0 sm:max-w-lg"
      >
        <DialogTitle className="sr-only">
          {t("commandPalette.title")}
        </DialogTitle>
        <Command className="flex h-full w-full flex-col overflow-hidden bg-surface text-foreground">
          <div className="flex items-center border-b border-hairline px-3.5">
            <Search className="me-2.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <Command.Input
              placeholder={t("commandPalette.placeholder")}
              className="flex h-12 w-full bg-transparent py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="hidden rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground sm:inline-block">
              ESC
            </kbd>
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-8 text-center text-sm text-muted-foreground">
              {t("commandPalette.noResults")}
            </Command.Empty>

            {items.length > 0 && (
              <Command.Group
                heading={t("commandPalette.navigation")}
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
              >
                {items.map((item) => (
                  <Command.Item
                    key={item.href}
                    value={`${t(item.titleKey)} ${item.href}`}
                    onSelect={() => runAndClose(() => router.push(item.href))}
                    className="flex cursor-pointer items-center justify-between rounded-[var(--radius-input)] px-2.5 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                  >
                    <span className="flex items-center gap-2.5">
                      <Compass className="h-4 w-4 text-muted-foreground" />
                      <span>{t(item.titleKey)}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground rtl:rotate-180" />
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Separator className="my-1.5 h-px bg-hairline" />

            <Command.Group
              heading={t("commandPalette.appearance")}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              <Command.Item
                value="light mode notion theme"
                onSelect={() => runAndClose(() => setTheme("light"))}
                className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Sun className="h-4 w-4 text-muted-foreground" />
                <span>{t("commandPalette.lightTheme")}</span>
              </Command.Item>
              <Command.Item
                value="dark mode nvidia theme"
                onSelect={() => runAndClose(() => setTheme("dark"))}
                className="flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-input)] px-2.5 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
              >
                <Moon className="h-4 w-4 text-muted-foreground" />
                <span>{t("commandPalette.darkTheme")}</span>
              </Command.Item>
            </Command.Group>

            <Command.Separator className="my-1.5 h-px bg-hairline" />

            <Command.Group
              heading={t("commandPalette.language")}
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground"
            >
              {(["en", "ar"] as const).map((lang) => (
                <Command.Item
                  key={lang}
                  value={`language ${lang}`}
                  onSelect={() =>
                    runAndClose(() => {
                      if (lang !== locale) void switchLocale(lang);
                    })
                  }
                  className="flex cursor-pointer items-center justify-between rounded-[var(--radius-input)] px-2.5 py-2 text-sm text-foreground outline-none aria-selected:bg-accent aria-selected:text-accent-foreground"
                >
                  <span className="flex items-center gap-2.5">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {lang === "en"
                        ? "English"
                        : lang === "ar"
                          ? "العربية"
                          : "Français"}
                    </span>
                  </span>
                  {locale === lang && (
                    <span className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
