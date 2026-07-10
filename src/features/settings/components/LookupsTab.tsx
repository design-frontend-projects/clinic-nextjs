"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { deleteLookupValue, getLookupCategories, getLookups, upsertLookupValue } from "../actions";
import type { ResolvedLookupValue } from "../services/lookup.service";
import { TabError, TabLoading } from "./tab-states";
import { LookupValueDialog } from "./LookupValueDialog";

interface LookupCategory {
  id: string;
  code: string;
  name: string;
  name_ar: string | null;
  allow_tenant_values: boolean;
}

export function LookupsTab() {
  const t = useTranslations("settings.lookups");
  const tCommon = useTranslations("settings");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [categoryCode, setCategoryCode] = useState<string>("appointment_types");
  const [editing, setEditing] = useState<ResolvedLookupValue | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<ResolvedLookupValue | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["lookup-categories"],
    queryFn: async (): Promise<LookupCategory[]> => {
      const result = await getLookupCategories();
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as LookupCategory[];
    },
  });

  const valuesQuery = useQuery({
    queryKey: ["lookups", categoryCode],
    queryFn: async (): Promise<ResolvedLookupValue[]> => {
      const result = await getLookups({ categoryCode });
      if ("error" in result && result.error) throw new Error(result.error);
      return (result.data ?? []) as ResolvedLookupValue[];
    },
  });

  if (categoriesQuery.isLoading) return <TabLoading />;
  if (categoriesQuery.error) {
    return <TabError message={(categoriesQuery.error as Error).message} onRetry={() => categoriesQuery.refetch()} />;
  }

  const categories = categoriesQuery.data ?? [];
  const category = categories.find((c) => c.code === categoryCode);

  const handleDelete = async (value: ResolvedLookupValue) => {
    // Tenant rows are soft-deleted; global rows are hidden via a shadow row.
    const result = value.is_tenant_value
      ? await deleteLookupValue({ id: value.id })
      : await upsertLookupValue({
          categoryCode,
          code: value.code,
          label: value.label,
          label_ar: value.label_ar,
          display_order: value.display_order,
          is_active: false,
        });
    if (result && "error" in result && result.error) {
      toast.error(result.error);
    } else {
      toast.success(t("deleted"));
      queryClient.invalidateQueries({ queryKey: ["lookups", categoryCode] });
    }
    setDeleting(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="w-64 space-y-2">
            <p className="text-xs text-muted-foreground">{t("category")}</p>
            <Select value={categoryCode} onValueChange={setCategoryCode}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {locale === "ar" && c.name_ar ? c.name_ar : c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={() => setAdding(true)} disabled={!category?.allow_tenant_values}>
            <Plus className="size-4" />
            {t("addValue")}
          </Button>
        </div>

        {valuesQuery.isLoading ? (
          <TabLoading />
        ) : valuesQuery.error ? (
          <TabError message={(valuesQuery.error as Error).message} onRetry={() => valuesQuery.refetch()} />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("code")}</TableHead>
                  <TableHead>{t("label")}</TableHead>
                  <TableHead>{t("labelAr")}</TableHead>
                  <TableHead>{t("order")}</TableHead>
                  <TableHead>{tCommon("notificationsTab.source")}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(valuesQuery.data ?? []).map((value) => (
                  <TableRow key={value.id} className={value.is_active ? "" : "opacity-50"}>
                    <TableCell className="font-mono text-xs">{value.code}</TableCell>
                    <TableCell>{value.label}</TableCell>
                    <TableCell dir="rtl">{value.label_ar ?? "—"}</TableCell>
                    <TableCell>{value.display_order}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Badge variant={value.is_tenant_value ? "default" : "outline"}>
                          {value.is_tenant_value ? t("custom") : t("global")}
                        </Badge>
                        {value.shadows_global && <Badge variant="secondary">{t("shadowed")}</Badge>}
                        {!value.is_active && <Badge variant="outline">{t("inactive")}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-end">
                      {category?.allow_tenant_values && (
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => setEditing(value)}>
                            {tCommon("common.edit")}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => setDeleting(value)}>
                            {tCommon("common.delete")}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {(adding || editing) && (
        <LookupValueDialog
          key={editing?.id ?? "new"}
          categoryCode={categoryCode}
          value={editing}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
        />
      )}

      <AlertDialog open={deleting !== null} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleting && handleDelete(deleting)}>
              {tCommon("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
