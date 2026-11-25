"use client";

import { AlertTriangle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TenantAccessWarning } from "@/lib/tenant-access";

interface GracePeriodBannerProps {
  warning: TenantAccessWarning;
}

export function GracePeriodBanner({ warning }: GracePeriodBannerProps) {
  const t = useTranslations("dashboard.graceBanner");
  const endDateFormatted = new Date(warning.endDate).toLocaleDateString();

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs sm:text-sm text-amber-800 dark:text-amber-300"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        {t("message", {
          endDate: endDateFormatted,
          days: warning.daysRemaining,
        })}
      </span>
    </div>
  );
}
