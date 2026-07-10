"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/routing";
import { getMyPreferences, updateMyPreferences } from "../actions";
import type { ResolvedSetting } from "../domain/models";
import { TabError, TabLoading } from "./tab-states";

const DATE_FORMATS = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;

export function UserPreferencesForm() {
  const t = useTranslations("settings.preferences");
  const tCommon = useTranslations("settings");
  const tLoc = useTranslations("settings.localization");
  const { setTheme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<string, string>>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-preferences"],
    queryFn: async (): Promise<ResolvedSetting[]> => {
      const result = await getMyPreferences();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as ResolvedSetting[];
    },
  });

  if (isLoading) return <TabLoading />;
  if (error) return <TabError message={(error as Error).message} onRetry={() => refetch()} />;

  const resolved = Object.fromEntries((data ?? []).map((s) => [s.key, String(s.value)]));
  const current = (key: string, fallback: string) => edits[key] ?? resolved[key] ?? fallback;

  const theme = current("preferences.theme", "system");
  const language = current("localization.default_language", locale);
  const timezone = current("localization.timezone", "UTC");
  const dateFormat = current("localization.date_format", "DD/MM/YYYY");

  const setEdit = (key: string, value: string) => setEdits((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateMyPreferences({
        updates: [
          { key: "preferences.theme", value: theme },
          { key: "localization.default_language", value: language },
          { key: "localization.timezone", value: timezone },
          { key: "localization.date_format", value: dateFormat },
        ],
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tCommon("saved"));
      queryClient.invalidateQueries({ queryKey: ["my-preferences"] });
      // Apply the runtime mechanisms immediately (DB is the cross-device source
      // of truth; next-themes/next-intl remain the runtime drivers).
      setTheme(theme);
      if (language !== locale && (language === "en" || language === "ar")) {
        router.replace(pathname, { locale: language });
      }
    });
  };

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("theme")}</Label>
            <Select value={theme} onValueChange={(value) => setEdit("preferences.theme", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t("themes.light")}</SelectItem>
                <SelectItem value="dark">{t("themes.dark")}</SelectItem>
                <SelectItem value="system">{t("themes.system")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("language")}</Label>
            <Select value={language} onValueChange={(value) => setEdit("localization.default_language", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">{tLoc("languages.en")}</SelectItem>
                <SelectItem value="ar">{tLoc("languages.ar")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pref-timezone">{t("timezone")}</Label>
            <Input
              id="pref-timezone"
              placeholder="Africa/Cairo"
              value={timezone}
              onChange={(event) => setEdit("localization.timezone", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("dateFormat")}</Label>
            <Select value={dateFormat} onValueChange={(value) => setEdit("localization.date_format", value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMATS.map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
