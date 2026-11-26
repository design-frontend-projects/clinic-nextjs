import { Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/routing";
import { getTenants } from "@/app/actions/app-owner/tenants";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TenantApprovalDialog } from "@/components/app-owner/tenant-approval-dialog";
import { TenantRowActions } from "@/components/app-owner/tenant-row-actions";

type TabFilter = "all" | "requests" | "active" | "closed";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ tab: rawTab }, tenants, t] = await Promise.all([
    searchParams,
    getTenants(),
    getTranslations("appOwner.tenants"),
  ]);

  const activeTab: TabFilter =
    rawTab === "requests" || rawTab === "active" || rawTab === "closed"
      ? rawTab
      : "all";

  const pendingCount = tenants.filter(
    (item) => item.status === "under_review",
  ).length;

  const filteredTenants = tenants.filter((item) => {
    if (activeTab === "requests") {
      return item.status === "under_review" || item.status === "rejected";
    }
    if (activeTab === "active") {
      return item.status === "active" || item.status === "trial";
    }
    if (activeTab === "closed") {
      return item.status === "suspended" || item.status === "rejected";
    }
    return true;
  });

  const tabItems: Array<{ key: TabFilter; label: string; count?: number }> = [
    { key: "all", label: t("tabs.all"), count: tenants.length },
    { key: "requests", label: t("tabs.requests"), count: pendingCount },
    { key: "active", label: t("tabs.active") },
    { key: "closed", label: t("tabs.closed") },
  ];

  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/app-owner/tenants/new">
            <Plus className="me-2 h-4 w-4" />
            {t("createTenant")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {tabItems.map((tab) => {
          const isCurrent = activeTab === tab.key;
          return (
            <Button
              key={tab.key}
              asChild
              variant={isCurrent ? "default" : "outline"}
              size="sm"
            >
              <Link
                href={
                  tab.key === "all"
                    ? "/app-owner/tenants"
                    : `/app-owner/tenants?tab=${tab.key}`
                }
              >
                <span>{tab.label}</span>
                {typeof tab.count === "number" && (
                  <Badge
                    variant={isCurrent ? "secondary" : "outline"}
                    className="ms-2 px-1.5 py-0 text-xs"
                  >
                    {tab.count}
                  </Badge>
                )}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.clinicName")}</TableHead>
              <TableHead>{t("table.refNumber")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.subscription")}</TableHead>
              <TableHead>{t("table.payment")}</TableHead>
              <TableHead>{t("table.expiry")}</TableHead>
              <TableHead>{t("table.users")}</TableHead>
              <TableHead>{t("table.patients")}</TableHead>
              <TableHead>{t("table.created")}</TableHead>
              <TableHead className="text-end">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTenants.map((tenant) => {
              const sub = tenant.tenant_subscription;
              const owner = tenant.staff_profiles[0] ?? null;
              const isReviewable =
                tenant.status === "under_review" ||
                tenant.status === "rejected";
              const isExpired =
                sub?.end_date &&
                sub.billing_cycle !== "lifetime" &&
                new Date(sub.end_date).getTime() < now.getTime();

              return (
                <TableRow key={tenant.id}>
                  <TableCell className="font-medium">
                    <div>{tenant.name}</div>
                    {owner?.email && (
                      <div className="text-xs text-muted-foreground">
                        {owner.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {tenant.request_ref || "—"}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={tenant.status} />
                  </TableCell>
                  <TableCell>
                    {sub?.plan ? (
                      <Badge variant="outline">{sub.plan.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        {t("noActivePlan")}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {sub ? (
                      <StatusBadge status={sub.payment_status} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {!sub ? (
                      "—"
                    ) : sub.billing_cycle === "lifetime" ? (
                      t("lifetime")
                    ) : sub.end_date ? (
                      <span
                        className={
                          isExpired
                            ? "font-medium text-destructive"
                            : "text-foreground"
                        }
                      >
                        {new Date(sub.end_date).toLocaleDateString()}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{tenant._count.staff_profiles}</TableCell>
                  <TableCell>{tenant._count.patients}</TableCell>
                  <TableCell>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-2">
                      {isReviewable && (
                        <TenantApprovalDialog
                          tenant={{
                            id: tenant.id,
                            name: tenant.name,
                            status: tenant.status,
                            request_ref: tenant.request_ref,
                            created_at: tenant.created_at.toISOString(),
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
                                  plan_name: sub.plan?.name ?? null,
                                  billing_cycle: sub.billing_cycle,
                                  price: Number(sub.price),
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
                                price: Number(sub.price),
                                status: sub.status,
                                payment_status: sub.payment_status,
                                payment_reference: sub.payment_reference,
                                start_date: sub.start_date.toISOString(),
                                end_date: sub.end_date?.toISOString() ?? null,
                                grace_period_days: sub.grace_period_days,
                              }
                            : null
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredTenants.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={10}
                  className="text-center h-24 text-muted-foreground"
                >
                  {t("noTenants")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
