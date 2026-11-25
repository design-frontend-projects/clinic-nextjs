"use client";

import { ColumnDef } from "@tanstack/react-table";
import {
  Ban,
  Eye,
  MoreHorizontal,
  Pencil,
  Pill,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatMedicineLabel,
  MEDICINE_CATEGORIES,
  type ClinicMedicineRecord,
} from "@/types/medication.types";

interface MedicineColumnHandlers {
  onView: (medicine: ClinicMedicineRecord) => void;
  onEdit: (medicine: ClinicMedicineRecord) => void;
  onStop: (medicine: ClinicMedicineRecord) => void;
  onResume: (medicine: ClinicMedicineRecord) => void;
}

function summarizeDefaults(med: ClinicMedicineRecord): string {
  const parts = [
    med.default_dosage,
    med.default_frequency,
    med.default_duration,
    med.route,
    med.default_quantity ? `×${med.default_quantity}` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export function createMedicineColumns(
  handlers: MedicineColumnHandlers,
  t: (key: string, values?: Record<string, string | number | Date>) => string,
): ColumnDef<ClinicMedicineRecord>[] {
  return [
    {
      id: "medicine",
      accessorFn: (row) =>
        [row.generic_name, row.brand_name, row.strength, row.form, row.category]
          .filter(Boolean)
          .join(" "),
      header: t("table.colMedicine"),
      cell: ({ row }) => {
        const med = row.original;
        const label = formatMedicineLabel(med);
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-blue-soft text-accent-blue">
              <Pill className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-foreground truncate">{label}</p>
              <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                {med.form && (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {med.form}
                  </Badge>
                )}
                {med.route && <span>{med.route}</span>}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: t("table.colCategory"),
      cell: ({ row }) => {
        const cat = row.original.category;
        if (!cat) return <span className="text-muted-foreground">—</span>;
        const isKnown = (MEDICINE_CATEGORIES as readonly string[]).includes(cat);
        return (
          <span className="text-sm text-foreground">
            {isKnown ? t(`categories.${cat}`) : cat}
          </span>
        );
      },
    },
    {
      id: "defaults",
      header: t("table.colDefaults"),
      cell: ({ row }) => {
        const summary = summarizeDefaults(row.original);
        if (!summary) {
          return (
            <span className="text-xs text-muted-foreground italic">
              {t("table.noDefaults")}
            </span>
          );
        }
        return (
          <span className="text-xs text-muted-foreground line-clamp-2 max-w-[260px]">
            {summary}
          </span>
        );
      },
    },
    {
      accessorKey: "is_active",
      header: t("table.colStatus"),
      cell: ({ row }) => {
        const med = row.original;
        return (
          <div className="space-y-1">
            <StatusBadge status={med.is_active ? "active" : "stopped"} />
            {!med.is_active && med.stop_reason && (
              <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-[180px]">
                {med.stop_reason}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const med = row.original;
        return (
          <div className="flex justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("table.ariaRowActions")}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handlers.onView(med)}>
                  <Eye className="me-2 h-4 w-4" />
                  {t("actions.view")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handlers.onEdit(med)}>
                  <Pencil className="me-2 h-4 w-4" />
                  {t("actions.edit")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {med.is_active ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => handlers.onStop(med)}
                  >
                    <Ban className="me-2 h-4 w-4" />
                    {t("actions.stop")}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    className="text-emerald-600 focus:text-emerald-600 dark:text-emerald-400"
                    onClick={() => handlers.onResume(med)}
                  >
                    <RotateCcw className="me-2 h-4 w-4" />
                    {t("actions.resume")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ];
}
