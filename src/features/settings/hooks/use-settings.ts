// src/features/settings/hooks/use-settings.ts
// Shared TanStack Query hooks for the tenant settings UI.
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getTenantSettings, updateTenantSettings } from "../actions";
import type { ResolvedSetting } from "../domain/models";

export function useModuleSettings(module?: string) {
  return useQuery({
    queryKey: ["tenant-settings", module ?? "all"],
    queryFn: async (): Promise<ResolvedSetting[]> => {
      const result = await getTenantSettings(module);
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as ResolvedSetting[];
    },
  });
}

/** Flattens resolved settings into a key -> value record for form defaults. */
export function valuesByKey(settings: ResolvedSetting[] | undefined): Record<string, unknown> {
  return (settings ?? []).reduce<Record<string, unknown>>(
    (acc, setting) => ({ ...acc, [setting.key]: setting.value }),
    {}
  );
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  const t = useTranslations("settings");

  return useMutation({
    mutationFn: async (updates: { key: string; value: unknown }[]) => {
      const result = await updateTenantSettings({ updates });
      if (result && "error" in result && result.error) throw new Error(result.error);
    },
    onSuccess: () => {
      toast.success(t("saved"));
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
      queryClient.invalidateQueries({ queryKey: ["settings-history"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || t("saveFailed"));
    },
  });
}
