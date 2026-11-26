"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpDown, Pill, Plus, Search, X } from "lucide-react";

import { Link } from "@/i18n/routing";
import type { ClinicOption } from "@/types/medication.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { MedicationClinicSelector } from "@/components/app-owner/medication-clinic-selector";
import { MedicationRowActions } from "@/components/app-owner/medication-row-actions";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";

export interface SerializedMedication {
  id: string;
  generic_name: string;
  brand_name: string | null;
  strength: string | null;
  form: string | null;
  route: string | null;
  price: number | null;
  is_active: boolean;
}

type StatusFilter = "all" | "active" | "inactive";

interface MedicationsViewProps {
  clinics: ClinicOption[];
  selectedClinicId: string;
  medications: SerializedMedication[];
}

export function MedicationsView({
  clinics,
  selectedClinicId,
  medications,
}: MedicationsViewProps) {
  const locale = useLocale();
  const t = useTranslations("appOwner.medications");
  const tCommon = useTranslations("appOwner.common");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return medications.filter((med) => {
      if (statusFilter === "active" && !med.is_active) return false;
      if (statusFilter === "inactive" && med.is_active) return false;
      if (!q) return true;
      return [med.generic_name, med.brand_name, med.strength, med.form].some(
        (v) => v?.toLowerCase().includes(q),
      );
    });
  }, [medications, search, statusFilter]);

  const formatPrice = (price: number | null) => {
    if (price == null) return "—";
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  const columns = useMemo<ColumnDef<SerializedMedication>[]>(
    () => [
      {
        accessorKey: "generic_name",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("generic")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-semibold text-foreground">
            {row.original.generic_name}
          </span>
        ),
      },
      {
        accessorKey: "brand_name",
        header: t("brand"),
        cell: ({ row }) => (
          <span className="text-foreground">
            {row.original.brand_name || "—"}
          </span>
        ),
      },
      {
        accessorKey: "strength",
        header: t("strength"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.strength || "—"}
          </span>
        ),
      },
      {
        accessorKey: "form",
        header: t("form"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.form || "—"}
          </span>
        ),
      },
      {
        accessorKey: "price",
        header: t("price"),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {formatPrice(row.original.price)}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("status"),
        cell: ({ row }) => (
          <StatusBadge status={row.original.is_active ? "active" : "inactive"} />
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">{t("actions")}</div>,
        cell: ({ row }) => (
          <MedicationRowActions
            id={row.original.id}
            isActive={row.original.is_active}
            activateLabel={t("activate")}
            deactivateLabel={t("deactivate")}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, t],
  );

  const statusButtons: Array<{ key: StatusFilter; label: string }> = [
    { key: "all", label: tCommon("allStatuses") },
    { key: "active", label: t("active") },
    { key: "inactive", label: t("inactive") },
  ];

  return (
    <FadeInStagger className="space-y-6">
      <FadeInItem>
        <AppOwnerPageHeader
          title={t("title")}
          description={t("subtitle")}
          actions={
            <Button asChild>
              <Link href={`/app-owner/medications/new?clinic=${selectedClinicId}`}>
                <Plus className="me-2 h-4 w-4" />
                {t("newButton")}
              </Link>
            </Button>
          }
        />
      </FadeInItem>

      {/* Responsive Toolbar */}
      <FadeInItem>
        <div className="flex flex-col gap-3 border-b border-hairline pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <MedicationClinicSelector
              clinics={clinics}
              value={selectedClinicId}
              label={t("clinic")}
            />

            <div className="relative w-full sm:w-64">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="ps-9 pe-8"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label={tCommon("clearSearch")}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
            {statusButtons.map((b) => (
              <Button
                key={b.key}
                type="button"
                size="sm"
                variant={statusFilter === b.key ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setStatusFilter(b.key)}
              >
                {b.label}
              </Button>
            ))}
          </div>
        </div>
      </FadeInItem>

      {/* Desktop Table */}
      <FadeInItem className="hidden md:block">
        <DataTable columns={columns} data={filtered} />
      </FadeInItem>

      {/* Mobile Cards */}
      <FadeInItem className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <Card elevated className="p-8 text-center">
            <Pill className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {medications.length === 0
                ? t("empty")
                : t("noMatchingMedications")}
            </p>
          </Card>
        ) : (
          filtered.map((med) => (
            <Card key={med.id} elevated cornerAccent className="py-0">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate font-semibold text-foreground">
                      {med.generic_name}
                    </h3>
                    {med.brand_name && (
                      <p className="truncate text-xs text-muted-foreground">
                        {med.brand_name}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={med.is_active ? "active" : "inactive"}
                    className="shrink-0"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {med.strength && (
                    <Badge variant="outline" className="text-[11px]">
                      {med.strength}
                    </Badge>
                  )}
                  {med.form && (
                    <Badge variant="outline" className="text-[11px]">
                      {med.form}
                    </Badge>
                  )}
                  {med.route && (
                    <Badge variant="outline" className="text-[11px]">
                      {med.route}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-hairline-soft pt-3 dark:border-hairline">
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    {formatPrice(med.price)}
                  </span>
                  <MedicationRowActions
                    id={med.id}
                    isActive={med.is_active}
                    activateLabel={t("activate")}
                    deactivateLabel={t("deactivate")}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </FadeInItem>
    </FadeInStagger>
  );
}
