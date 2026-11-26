"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpDown,
  Check,
  CreditCard,
  Edit2,
  LayoutGrid,
  Plus,
  Search,
  Table2,
  Users,
  X,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";
import { PlanRowActions } from "@/components/app-owner/plan-row-actions";
import { cn } from "@/lib/utils";

export interface SerializedPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  billing_period: string;
  trial_days: number | null;
  status: string;
  max_users: number | null;
  max_doctors: number | null;
  max_branches: number | null;
  activeSubsCount: number;
  features: Array<{
    id: string;
    feature_name: string;
    is_enabled: boolean;
  }>;
}

type PlanStatusFilter = "all" | "active" | "inactive" | "archived";

function formatPlanCurrency(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currency || "USD",
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || "USD"}`;
  }
}

export function PlansView({ plans }: { plans: SerializedPlan[] }) {
  const locale = useLocale();
  const t = useTranslations("appOwner.plans");
  const tPeriods = useTranslations("appOwner.planEditor.periods");
  const tCommon = useTranslations("appOwner.common");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PlanStatusFilter>("all");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  const filteredPlans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return plans.filter((plan) => {
      if (statusFilter !== "all" && plan.status !== statusFilter) return false;
      if (!q) return true;
      return (
        plan.name.toLowerCase().includes(q) ||
        (plan.description?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [plans, search, statusFilter]);

  const periodLabel = (period: string) => {
    switch (period) {
      case "monthly":
      case "quarterly":
      case "semi_annual":
      case "annual":
      case "lifetime":
        return tPeriods(period);
      default:
        return period.replace("_", " ");
    }
  };

  const columns = useMemo<ColumnDef<SerializedPlan>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("planName")}</span>
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
        accessorKey: "price",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("price")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums text-foreground">
            {formatPlanCurrency(
              row.original.price,
              row.original.currency,
              locale,
            )}
          </span>
        ),
      },
      {
        accessorKey: "billing_period",
        header: t("billingPeriod"),
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">
            {periodLabel(row.original.billing_period)}
          </Badge>
        ),
      },
      {
        accessorKey: "status",
        header: t("status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "activeSubsCount",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("activeSubs")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums text-foreground">
            {row.original.activeSubsCount}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">{t("actions")}</div>,
        cell: ({ row }) => (
          <PlanRowActions
            planId={row.original.id}
            planName={row.original.name}
            activeSubsCount={row.original.activeSubsCount}
          />
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, t],
  );

  const statusFilters: Array<{ key: PlanStatusFilter; label: string }> = [
    { key: "all", label: tCommon("allStatuses") },
    { key: "active", label: t("active") },
    { key: "inactive", label: t("inactive") },
    { key: "archived", label: t("archived") },
  ];

  return (
    <FadeInStagger className="space-y-6">
      <FadeInItem>
        <AppOwnerPageHeader
          title={t("title")}
          description={t("subtitle")}
          actions={
            <Button asChild>
              <Link href="/app-owner/plans/new">
                <Plus className="me-2 h-4 w-4" />
                {t("newButton")}
              </Link>
            </Button>
          }
        />
      </FadeInItem>

      {/* Toolbar */}
      <FadeInItem>
        <div className="flex flex-col gap-3 border-b border-hairline pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
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

            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
              {statusFilters.map((f) => (
                <Button
                  key={f.key}
                  type="button"
                  size="sm"
                  variant={statusFilter === f.key ? "default" : "outline"}
                  className="capitalize shrink-0"
                  onClick={() => setStatusFilter(f.key)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="hidden items-center gap-1 rounded-[var(--radius-button)] border border-hairline bg-canvas-soft p-1 md:inline-flex dark:bg-surface-elevated">
            <Button
              type="button"
              size="sm"
              variant={viewMode === "cards" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("cards")}
            >
              <LayoutGrid className="me-1.5 h-3.5 w-3.5" />
              {tCommon("cardsView")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === "table" ? "secondary" : "ghost"}
              className="h-7 px-2.5 text-xs"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="me-1.5 h-3.5 w-3.5" />
              {tCommon("tableView")}
            </Button>
          </div>
        </div>
      </FadeInItem>

      {/* Cards Grid (Always on mobile, or when cards view selected on desktop) */}
      <FadeInItem className={cn(viewMode === "table" && "md:hidden")}>
        {filteredPlans.length === 0 ? (
          <Card elevated className="p-10 text-center">
            <CreditCard className="mx-auto mb-2.5 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {plans.length === 0 ? t("noPlansFound") : t("noMatchingPlans")}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredPlans.map((plan) => {
              const enabledFeatures = plan.features.filter((f) => f.is_enabled);
              const visibleFeatures = enabledFeatures.slice(0, 5);
              const remainingFeatures =
                enabledFeatures.length - visibleFeatures.length;

              return (
                <Card
                  key={plan.id}
                  elevated
                  cornerAccent
                  className="flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="truncate text-lg">
                            {plan.name}
                          </CardTitle>
                          {plan.description && (
                            <CardDescription className="line-clamp-2 text-xs">
                              {plan.description}
                            </CardDescription>
                          )}
                        </div>
                        <StatusBadge status={plan.status} className="shrink-0" />
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Price & Cycle */}
                      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline-soft pb-4 dark:border-hairline">
                        <div>
                          <span className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                            {formatPlanCurrency(
                              plan.price,
                              plan.currency,
                              locale,
                            )}
                          </span>
                          <span className="ms-1.5 text-xs text-muted-foreground">
                            / {periodLabel(plan.billing_period)}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {(plan.trial_days ?? 0) > 0 && (
                            <Badge variant="outline" className="text-[11px]">
                              {t("trialDaysBadge", {
                                days: plan.trial_days ?? 0,
                              })}
                            </Badge>
                          )}
                          <Badge
                            variant="secondary"
                            className="gap-1 text-[11px] tabular-nums"
                          >
                            <Users className="h-3 w-3" />
                            {t("subscribersCount", {
                              count: plan.activeSubsCount,
                            })}
                          </Badge>
                        </div>
                      </div>

                      {/* Quotas Summary */}
                      <div className="grid grid-cols-3 gap-2 rounded-[var(--radius-button)] border border-hairline-soft bg-canvas-soft/60 p-2.5 text-center text-xs dark:border-hairline dark:bg-surface-elevated/50">
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("usersLimit")}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {plan.max_users ?? t("unlimited")}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("doctorsLimit")}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {plan.max_doctors ?? t("unlimited")}
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t("branchesLimit")}
                          </span>
                          <span className="font-semibold tabular-nums text-foreground">
                            {plan.max_branches ?? t("unlimited")}
                          </span>
                        </div>
                      </div>

                      {/* Enabled Features */}
                      {visibleFeatures.length > 0 && (
                        <ul className="space-y-1.5 text-xs">
                          {visibleFeatures.map((feat) => (
                            <li
                              key={feat.id}
                              className="flex items-center gap-2 text-foreground"
                            >
                              <Check className="h-3.5 w-3.5 shrink-0 text-accent-green" />
                              <span className="truncate">
                                {feat.feature_name}
                              </span>
                            </li>
                          ))}
                          {remainingFeatures > 0 && (
                            <li className="ps-5 text-[11px] font-medium text-muted-foreground">
                              {t("moreFeatures", { count: remainingFeatures })}
                            </li>
                          )}
                        </ul>
                      )}
                    </CardContent>
                  </div>

                  <CardFooter className="mt-4 justify-between gap-2 border-t border-hairline-soft pt-4 dark:border-hairline">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/app-owner/plans/${plan.id}`}>
                        <Edit2 className="me-1.5 h-3.5 w-3.5" />
                        {t("edit")}
                      </Link>
                    </Button>
                    <PlanRowActions
                      planId={plan.id}
                      planName={plan.name}
                      activeSubsCount={plan.activeSubsCount}
                    />
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}
      </FadeInItem>

      {/* Desktop Table View */}
      {viewMode === "table" && (
        <FadeInItem className="hidden md:block">
          <DataTable columns={columns} data={filteredPlans} />
        </FadeInItem>
      )}
    </FadeInStagger>
  );
}
