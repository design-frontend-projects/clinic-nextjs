"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformSettingsOverview, updateGlobalSettings } from "@/app/actions/app-owner/settings";
import { DefinitionValueField } from "./DefinitionValueField";

interface PlatformSettingRow {
  key: string;
  module: string;
  category: string;
  value_type: string;
  validation: unknown;
  description: string | null;
  is_public: boolean;
  current_value: unknown;
  is_set: boolean;
}

export function PlatformSettingsEditor() {
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const [edits, setEdits] = useState<Record<string, unknown>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async (): Promise<PlatformSettingRow[]> => {
      const result = await getPlatformSettingsOverview();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as PlatformSettingRow[];
    },
  });

  if (isLoading) return <Skeleton className="h-48 w-full" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;

  const rows = data ?? [];
  const byModule = rows.reduce<Record<string, PlatformSettingRow[]>>((acc, row) => {
    return { ...acc, [row.module]: [...(acc[row.module] ?? []), row] };
  }, {});

  const handleSave = () => {
    const updates = Object.entries(edits).map(([key, value]) => {
      const row = rows.find((r) => r.key === key);
      return { key, value, category: row?.module ?? "platform", is_public: row?.is_public };
    });
    if (updates.length === 0) return;
    startTransition(async () => {
      const result = await updateGlobalSettings(updates);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Platform settings saved");
      setEdits({});
      queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
    });
  };

  return (
    <div className="space-y-4">
      {Object.entries(byModule).map(([module, settings]) => (
        <Card key={module}>
          <CardHeader>
            <CardTitle className="text-base capitalize">{module.replace(/_/g, " ")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.map((setting) => (
              <div key={setting.key} className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs">{setting.key}</p>
                    {!setting.is_set && <Badge variant="outline">default</Badge>}
                  </div>
                  {setting.description && (
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  )}
                </div>
                <DefinitionValueField
                  definition={setting}
                  value={setting.key in edits ? edits[setting.key] : setting.current_value}
                  onChange={(value) => setEdits((prev) => ({ ...prev, [setting.key]: value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isPending || Object.keys(edits).length === 0}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
