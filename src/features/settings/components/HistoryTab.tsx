"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getSettingsHistory, rollbackSetting } from "../actions";

interface HistoryRow {
  id: string;
  scope: string;
  definition_key: string;
  old_value: unknown;
  new_value: unknown;
  version: number;
  changed_at: string | Date;
}

const PAGE_SIZE = 20;

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 60 ? `${text.slice(0, 60)}…` : text;
}

export function HistoryTab() {
  const t = useTranslations("settings.history");
  const tCommon = useTranslations("settings");
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [rollbackTarget, setRollbackTarget] = useState<HistoryRow | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["settings-history", page],
    queryFn: async (): Promise<{ rows: HistoryRow[]; total: number }> => {
      const result = await getSettingsHistory({ page, limit: PAGE_SIZE });
      if ("error" in result && result.error) throw new Error(result.error);
      return result.data as { rows: HistoryRow[]; total: number };
    },
  });

  const handleRollback = async (row: HistoryRow) => {
    const result = await rollbackSetting({ historyId: row.id });
    if (result && "error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("rolledBack"));
      queryClient.invalidateQueries({ queryKey: ["settings-history"] });
      queryClient.invalidateQueries({ queryKey: ["tenant-settings"] });
    }
    setRollbackTarget(null);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{tCommon("loading")}</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{(error as Error).message}</p>
        ) : (data?.rows.length ?? 0) === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("setting")}</TableHead>
                  <TableHead>{t("oldValue")}</TableHead>
                  <TableHead>{t("newValue")}</TableHead>
                  <TableHead>{t("version")}</TableHead>
                  <TableHead>{t("changedAt")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-xs">{row.definition_key}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">{formatValue(row.old_value)}</TableCell>
                    <TableCell className="max-w-48 truncate font-mono text-xs">{formatValue(row.new_value)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">v{row.version}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(row.changed_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-end">
                      {row.scope === "tenant" && row.old_value !== null && (
                        <Button variant="ghost" size="sm" onClick={() => setRollbackTarget(row)}>
                          {t("rollback")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ‹
            </Button>
            <span className="text-xs text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              ›
            </Button>
          </div>
        )}
      </CardContent>

      <AlertDialog open={rollbackTarget !== null} onOpenChange={(open) => !open && setRollbackTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("rollbackTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("rollbackBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => rollbackTarget && handleRollback(rollbackTarget)}>
              {t("rollback")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
