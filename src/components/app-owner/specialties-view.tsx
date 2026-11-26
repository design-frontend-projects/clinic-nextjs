"use client";

import { useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Edit2,
  Plus,
  Search,
  Stethoscope,
  X,
} from "lucide-react";

import { Link, useRouter } from "@/i18n/routing";
import { toggleSpecialtyActive } from "@/app/actions/app-owner/specialties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";

export interface SerializedSpecialty {
  id: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  doctorsCount: number;
}

type StatusFilter = "all" | "active" | "inactive";

function SpecialtyStatusSwitch({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("appOwner.specialties");
  const [isPending, startTransition] = useTransition();

  const onToggle = (checked: boolean) => {
    startTransition(async () => {
      try {
        await toggleSpecialtyActive(id, checked);
        toast.success(checked ? t("toastActivated") : t("toastDeactivated"));
        router.refresh();
      } catch {
        toast.error(t("toastToggleFailed"));
      }
    });
  };

  return (
    <Switch
      checked={isActive}
      disabled={isPending}
      onCheckedChange={onToggle}
      aria-label={`${name} — ${isActive ? t("active") : t("inactive")}`}
    />
  );
}

export function SpecialtiesView({
  specialties,
}: {
  specialties: SerializedSpecialty[];
}) {
  const t = useTranslations("appOwner.specialties");
  const tCommon = useTranslations("appOwner.common");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return specialties.filter((item) => {
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        (item.name_ar?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [specialties, search, statusFilter]);

  const columns = useMemo<ColumnDef<SerializedSpecialty>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("name")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <div className="min-w-0 max-w-[240px]">
            <div className="truncate font-semibold text-foreground">
              {row.original.name}
            </div>
            {row.original.description && (
              <div className="truncate text-xs text-muted-foreground">
                {row.original.description}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "name_ar",
        header: t("nameAr"),
        cell: ({ row }) => (
          <span dir="rtl" className="inline-block font-medium text-foreground">
            {row.original.name_ar || "—"}
          </span>
        ),
      },
      {
        accessorKey: "display_order",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("order")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <Badge variant="outline" className="tabular-nums">
            #{row.original.display_order}
          </Badge>
        ),
      },
      {
        accessorKey: "doctorsCount",
        header: t("doctors"),
        cell: ({ row }) => (
          <span className="tabular-nums text-muted-foreground">
            {row.original.doctorsCount}
          </span>
        ),
      },
      {
        accessorKey: "is_active",
        header: t("status"),
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <SpecialtyStatusSwitch
              id={row.original.id}
              name={row.original.name}
              isActive={row.original.is_active}
            />
            <StatusBadge
              status={row.original.is_active ? "active" : "inactive"}
            />
          </div>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">{t("actions")}</div>,
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={row.original.name}
            >
              <Link href={`/app-owner/specialties/${row.original.id}`}>
                <Edit2 className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ),
      },
    ],
    [t],
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
              <Link href="/app-owner/specialties/new">
                <Plus className="me-2 h-4 w-4" />
                {t("newButton")}
              </Link>
            </Button>
          }
        />
      </FadeInItem>

      {/* Toolbar */}
      <FadeInItem>
        <div className="flex flex-col gap-3 border-b border-hairline pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:w-72">
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
            <Stethoscope className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {specialties.length === 0
                ? t("empty")
                : t("noMatchingSpecialties")}
            </p>
          </Card>
        ) : (
          filtered.map((specialty) => (
            <Card key={specialty.id} elevated cornerAccent className="py-0">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 space-y-0.5">
                    <h3 className="truncate font-semibold text-foreground">
                      {specialty.name}
                    </h3>
                    {specialty.name_ar && (
                      <p
                        dir="rtl"
                        className="truncate text-sm text-muted-foreground"
                      >
                        {specialty.name_ar}
                      </p>
                    )}
                  </div>
                  <StatusBadge
                    status={specialty.is_active ? "active" : "inactive"}
                    className="shrink-0"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-hairline-soft pt-3 dark:border-hairline">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="tabular-nums">
                      #{specialty.display_order}
                    </Badge>
                    <span className="tabular-nums">
                      {t("doctorsCount", { count: specialty.doctorsCount })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <SpecialtyStatusSwitch
                      id={specialty.id}
                      name={specialty.name}
                      isActive={specialty.is_active}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      aria-label={specialty.name}
                    >
                      <Link href={`/app-owner/specialties/${specialty.id}`}>
                        <Edit2 className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </FadeInItem>
    </FadeInStagger>
  );
}
