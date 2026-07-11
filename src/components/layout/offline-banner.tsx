"use client";

import { useTranslations } from "next-intl";
import { WifiOff, RefreshCw } from "lucide-react";
import { useOnlineStore } from "@/stores/online-store";

/**
 * Slim status strip shown above the header: an amber offline notice, or a subtle
 * "syncing" chip while replication is active. Renders nothing when online and idle.
 */
export function OfflineBanner() {
  const t = useTranslations("offline");
  const isOnline = useOnlineStore((state) => state.isOnline);
  const isSyncing = useOnlineStore((state) => state.isSyncing);

  if (!isOnline) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-amber-500/15 px-4 py-2 text-sm text-amber-700 dark:text-amber-400"
      >
        <WifiOff className="size-4 shrink-0" aria-hidden />
        <span>{t("banner")}</span>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 bg-sky-500/10 px-4 py-1.5 text-xs text-sky-700 dark:text-sky-400"
      >
        <RefreshCw className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span>{t("syncing")}</span>
      </div>
    );
  }

  return null;
}
