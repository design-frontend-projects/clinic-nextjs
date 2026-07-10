"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { getTenantFeatures } from "../actions";
import type { FeatureDecision } from "../domain/models";
import { TabError, TabLoading } from "./tab-states";

export function FeatureFlagsTab() {
  const t = useTranslations("settings.features");
  const locale = useLocale();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["tenant-features"],
    queryFn: async (): Promise<FeatureDecision[]> => {
      const result = await getTenantFeatures();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as FeatureDecision[];
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={(error as Error).message} onRetry={() => refetch()} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(data ?? []).map((feature) => (
          <div
            key={feature.key}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">
                  {locale === "ar" && feature.name_ar ? feature.name_ar : feature.name}
                </p>
                {feature.is_beta && <Badge variant="outline">{t("beta")}</Badge>}
              </div>
              {feature.description && <p className="text-xs text-muted-foreground">{feature.description}</p>}
              <p className="text-xs text-muted-foreground">{t(`sources.${feature.source}` as never)}</p>
            </div>
            <div className="flex items-center gap-2">
              {/* Read-only: entitlements are decided by plan/platform, not here. */}
              <Switch checked={feature.enabled} disabled aria-readonly />
              <span className="text-xs text-muted-foreground">
                {feature.enabled ? t("enabled") : t("disabled")}
              </span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
