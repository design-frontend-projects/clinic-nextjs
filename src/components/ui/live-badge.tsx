"use client";

import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  className?: string;
}

/** Small pulsing dot + "Live" label, signalling a realtime-updated view. */
export function LiveBadge({ className }: LiveBadgeProps) {
  const t = useTranslations("pages.staff");
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
      </span>
      {t("live")}
    </span>
  );
}
