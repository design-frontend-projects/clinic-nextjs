"use client";

import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowUpDown,
  Building2,
  HeartPulse,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";

import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";
import { TenantApprovalDialog } from "@/components/app-owner/tenant-approval-dialog";
import { TenantRowActions } from "@/components/app-owner/tenant-row-actions";
import { cn } from "@/lib/utils";

export type TenantTabFilter = "all" | "requests" | "active" | "closed";

export interface SerializedTenantRow {
  id: string;
  name: string;
  status: string;
  request_ref: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
  auth_user_id: string | null;
  staffCount: number;
  patientsCount: number;
  owner: {
    id: string;
    auth_user_id: string | null;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    status: string;
  } | null;
  subscription: {
    plan_id: string;
    plan_name: string | null;
    billing_cycle: string;
    price: number;
    currency: string;
    status: string;
    payment_status: string;
    payment_reference: string | null;
    start_date: string;
    end_date: string | null;
    grace_period_days: number;
  } | null;
}

interface TenantsViewProps {
  tenants: SerializedTenantRow[];
  activeTab: TenantTabFilter;
  tabCounts: Record<TenantTabFilter, number>;
}

export function TenantsView({
  tenants,
  activeTab,
  tabCounts,
}: TenantsViewProps) {
  const locale = useLocale();
  const t = useTranslations("appOwner.tenants");
  const tCommon = useTranslations("appOwner.common");
  const [search, setSearch] = useState("");

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((tenant) => {
      const haystacks = [
        tenant.name,
        tenant.request_ref,
        tenant.email,
        tenant.owner?.full_name,
        tenant.owner?.email,
        tenant.subscription?.plan_name,
      ];
      return haystacks.some((val) => val?.toLowerCase().includes(q));
    });
  }, [tenants, search]);

  const tabItems: Array<{ key: TenantTabFilter; label: string; count: number }> = [
    { key: "all", label: t("tabs.all"), count: tabCounts.all },
    { key: "requests", label: t("tabs.requests"), count: tabCounts.requests },
    { key: "active", label: t("tabs.active"), count: tabCounts.active },
    { key: "closed", label: t("tabs.closed"), count: tabCounts.closed },
  ];

  const nowMs = Date.now();

  const renderExpiry = (sub: SerializedTenantRow["subscription"]) => {
    if (!sub) return <span className="text-muted-foreground">—</span>;
    if (sub.billing_cycle === "lifetime") {
      return <span className="text-xs font-medium">{t("lifetime")}</span>;
    }
    if (!sub.end_date) return <span className="text-muted-foreground">—</span>;
    const endTime = new Date(sub.end_date).getTime();
    const isExpired = endTime < nowMs;
    return (
      <span
        className={cn(
          "text-xs tabular-nums",
          isExpired ? "font-semibold text-destructive" : "text-foreground",
        )}
      >
        {new Date(sub.end_date).toLocaleDateString(locale)}
      </span>
    );
  };

  const renderActions = (tenant: SerializedTenantRow) => {
    const sub = tenant.subscription;
    const owner = tenant.owner;
    const isReviewable =
      tenant.status === "under_review" || tenant.status === "rejected";

    return (
      <div className="flex items-center justify-end gap-2">
        {isReviewable && (
          <TenantApprovalDialog
            tenant={{
              id: tenant.id,
              name: tenant.name,
              status: tenant.status,
              request_ref: tenant.request_ref,
              created_at: tenant.created_at,
              email: tenant.email,
              phone: tenant.phone,
            }}
            owner={
              owner
                ? {
                    full_name: owner.full_name,
                    email: owner.email,
                    phone: owner.phone,
                  }
                : null
            }
            initialSubscription={
              sub
                ? {
                    plan_id: sub.plan_id,
                    plan_name: sub.plan_name,
                    billing_cycle: sub.billing_cycle,
                    price: sub.price,
                    currency: sub.currency,
                    grace_period_days: sub.grace_period_days,
                  }
                : null
            }
          />
        )}
        <TenantRowActions
          tenant={{
            id: tenant.id,
            name: tenant.name,
            status: tenant.status,
            auth_user_id: tenant.auth_user_id,
          }}
          owner={
            owner
              ? {
                  id: owner.id,
                  auth_user_id: owner.auth_user_id,
                  full_name: owner.full_name,
                  email: owner.email,
                  status: owner.status,
                }
              : null
          }
          subscription={
            sub
              ? {
                  plan_id: sub.plan_id,
                  billing_cycle: sub.billing_cycle,
                  price: sub.price,
                  status: sub.status,
                  payment_status: sub.payment_status,
                  payment_reference: sub.payment_reference,
                  start_date: sub.start_date,
                  end_date: sub.end_date,
                  grace_period_days: sub.grace_period_days,
                }
              : null
          }
        />
      </div>
    );
  };

  const columns = useMemo<ColumnDef<SerializedTenantRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("table.clinicName")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => {
          const tenant = row.original;
          return (
            <div className="min-w-0 max-w-[220px]">
              <div className="truncate font-semibold text-foreground">
                {tenant.name}
              </div>
              {tenant.owner?.email && (
                <div className="truncate text-xs text-muted-foreground">
                  {tenant.owner.email}
                </div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: "request_ref",
        header: t("table.refNumber"),
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.request_ref || "—"}
          </span>
        ),
      },
      {
        accessorKey: "status",
        header: t("table.status"),
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      {
        id: "subscription",
        header: t("table.subscription"),
        cell: ({ row }) => {
          const sub = row.original.subscription;
          if (!sub) {
            return (
              <span className="text-xs text-muted-foreground">
                {t("noActivePlan")}
              </span>
            );
          }
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              {sub.plan_name && (
                <Badge variant="outline" className="text-xs">
                  {sub.plan_name}
                </Badge>
              )}
              <StatusBadge status={sub.payment_status} />
            </div>
          );
        },
      },
      {
        id: "expiry",
        header: t("table.expiry"),
        cell: ({ row }) => renderExpiry(row.original.subscription),
      },
      {
        id: "usage",
        header: t("usageColumn"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3 text-xs tabular-nums text-muted-foreground">
            <span className="inline-flex items-center gap-1" title={t("staffLabel")}>
              <Users className="h-3.5 w-3.5" />
              {row.original.staffCount}
            </span>
            <span
              className="inline-flex items-center gap-1"
              title={t("patientsLabel")}
            >
              <HeartPulse className="h-3.5 w-3.5" />
              {row.original.patientsCount}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <button
            type="button"
            className="inline-flex items-center gap-1 hover:text-foreground"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            <span>{t("table.created")}</span>
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ row }) => (
          <span className="text-xs tabular-nums text-muted-foreground">
            {new Date(row.original.created_at).toLocaleDateString(locale)}
          </span>
        ),
      },
      {
        id: "actions",
        header: () => <div className="text-end">{t("table.actions")}</div>,
        cell: ({ row }) => renderActions(row.original),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, t],
  );

  return (
    <FadeInStagger className="space-y-6">
      <FadeInItem>
        <AppOwnerPageHeader
          title={t("title")}
          description={t("subtitle")}
          actions={
            <Button asChild>
              <Link href="/app-owner/tenants/new">
                <Plus className="me-2 h-4 w-4" />
                {t("createTenant")}
              </Link>
            </Button>
          }
        />
      </FadeInItem>

      {/* Filter Tabs + Search */}
      <FadeInItem>
        <div className="flex flex-col gap-3 border-b border-hairline pb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {tabItems.map((tab) => {
              const isCurrent = activeTab === tab.key;
              return (
                <Button
                  key={tab.key}
                  asChild
                  variant={isCurrent ? "default" : "outline"}
                  size="sm"
                  className="shrink-0"
                >
                  <Link
                    href={
                      tab.key === "all"
                        ? "/app-owner/tenants"
                        : `/app-owner/tenants?tab=${tab.key}`
                    }
                  >
                    <span>{tab.label}</span>
                    <Badge
                      variant={isCurrent ? "secondary" : "outline"}
                      className="ms-2 px-1.5 py-0 text-[11px] tabular-nums"
                    >
                      {tab.count}
                    </Badge>
                  </Link>
                </Button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 sm:min-w-[280px] lg:w-80">
            <div className="relative flex-1">
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
        </div>
      </FadeInItem>

      {/* Desktop Table */}
      <FadeInItem className="hidden md:block">
        <DataTable columns={columns} data={filteredTenants} />
      </FadeInItem>

      {/* Mobile Card Stack */}
      <FadeInItem className="space-y-3 md:hidden">
        {filteredTenants.length === 0 ? (
          <Card elevated className="p-8 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">
              {search ? t("noMatchingTenants") : t("noTenants")}
            </p>
          </Card>
        ) : (
          filteredTenants.map((tenant) => {
            const sub = tenant.subscription;
            return (
              <Card key={tenant.id} elevated cornerAccent className="py-0">
                <CardContent className="space-y-3.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <h3 className="truncate font-semibold text-foreground">
                        {tenant.name}
                      </h3>
                      {tenant.owner?.email && (
                        <p className="truncate text-xs text-muted-foreground">
                          {tenant.owner.email}
                        </p>
                      )}
                    </div>
                    <StatusBadge status={tenant.status} className="shrink-0" />
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 rounded-[var(--radius-button)] border border-hairline-soft bg-canvas-soft/60 p-2.5 text-xs dark:border-hairline dark:bg-surface-elevated/50">
                    <div>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("table.subscription")}
                      </span>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1">
                        {sub?.plan_name ? (
                          <Badge variant="outline" className="text-[11px]">
                            {sub.plan_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">
                            {t("noActivePlan")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("table.payment")}
                      </span>
                      <div className="mt-0.5">
                        {sub ? (
                          <StatusBadge status={sub.payment_status} />
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("table.expiry")}
                      </span>
                      <div className="mt-0.5">{renderExpiry(sub)}</div>
                    </div>
                    <div>
                      <span className="block text-[11px] text-muted-foreground">
                        {t("usageColumn")}
                      </span>
                      <div className="mt-0.5 flex items-center gap-2.5 tabular-nums text-foreground">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3 text-muted-foreground" />
                          {tenant.staffCount}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <HeartPulse className="h-3 w-3 text-muted-foreground" />
                          {tenant.patientsCount}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {tenant.request_ref ||
                        new Date(tenant.created_at).toLocaleDateString(locale)}
                    </span>
                    {renderActions(tenant)}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </FadeInItem>
    </FadeInStagger>
  );
}
