"use client";

import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function TabLoading() {
  return (
    <div className="space-y-4 pt-4">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

export function TabError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const t = useTranslations("settings");
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-destructive">{message || t("loadFailed")}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          {t("retry")}
        </Button>
      )}
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive">{message}</p>;
}
