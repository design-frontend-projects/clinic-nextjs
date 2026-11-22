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
        "inline-flex items-center gap-1.5 rounded-[var(--radius-badge)] border border-accent-green/30 bg-accent-green-soft px-2.5 py-0.5 text-xs font-semibold text-accent-green dark:uppercase dark:tracking-wider",
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
      </span>
      {t("live")}
    </span>
  );
}
