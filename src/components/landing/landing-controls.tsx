"use client";

import { Globe } from "lucide-react";
import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useLocaleSwitcher } from "@/components/providers/intl-provider";

export function LandingControls() {
  const locale = useLocale();
  const { switchLocale } = useLocaleSwitcher();

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => void switchLocale(locale === "en" ? "ar" : "en")}
        title={locale === "en" ? "العربية" : "English"}
        aria-label="Switch language"
        className="text-muted-foreground hover:text-foreground"
      >
        <Globe className="h-4 w-4" />
      </Button>
      <ThemeToggle
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
      />
    </div>
  );
}
