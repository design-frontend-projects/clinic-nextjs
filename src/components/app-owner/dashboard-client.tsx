"use client";

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Building2,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";

import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  FadeInItem,
  FadeInStagger,
} from "@/components/app-owner/motion-primitives";
import { TenantApprovalDialog } from "@/components/app-owner/tenant-approval-dialog";

export interface DashboardPendingTenant {
  id: string;
  name: string;
  status: string;
  request_ref: string | null;
  created_at: string;
  email: string | null;
  phone: string | null;
  owner: {
    full_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
  initialSubscription: {
    plan_id: string;
    plan_name: string | null;
    billing_cycle: string;
    price: number;
    currency: string;
    grace_period_days: number;
  } | null;
}

export interface DashboardPlanAdoption {
  id: string;
  name: string;
  subscribers: number;
}

export interface AppOwnerDashboardClientProps {
  metrics: {
    totalTenants: number;
    pendingRequests: number;
    activeTenants: number;
    suspendedOrRejected: number;
    totalUsers: number;
    activeSubscriptions: number;
    plansCount: number;
  };
  pendingQueue: DashboardPendingTenant[];
  planAdoption: DashboardPlanAdoption[];
}

export function AppOwnerDashboardClient({
  metrics,
  pendingQueue,
  planAdoption,
}: AppOwnerDashboardClientProps) {
  const locale = useLocale();
  const t = useTranslations("appOwner.dashboard");
  const tLayout = useTranslations("appOwner.layout");
  const tCommon = useTranslations("appOwner.common");
  const tTenants = useTranslations("appOwner.tenants");
  const tPlans = useTranslations("appOwner.plans");

  const tenantMixData = useMemo(
    () =>
      [
        {
          key: "active",
          label: t("activeTenants"),
          value: metrics.activeTenants,
          fill: "var(--chart-1)",
        },
        {
          key: "pending",
          label: t("pendingRequests"),
          value: metrics.pendingRequests,
          fill: "var(--chart-3)",
        },
        {
          key: "closed",
          label: t("suspendedRejected"),
          value: metrics.suspendedOrRejected,
          fill: "var(--chart-5)",
        },
      ].filter((item) => item.value > 0),
    [metrics.activeTenants, metrics.pendingRequests, metrics.suspendedOrRejected, t],
  );

  const tenantMixConfig = useMemo<ChartConfig>(
    () => ({
      active: { label: t("activeTenants"), color: "var(--chart-1)" },
      pending: { label: t("pendingRequests"), color: "var(--chart-3)" },
      closed: { label: t("suspendedRejected"), color: "var(--chart-5)" },
    }),
    [t],
  );

  const planChartConfig = useMemo<ChartConfig>(
    () => ({
      subscribers: { label: t("subscribers"), color: "var(--chart-1)" },
    }),
    [t],
  );

  const quickActions = [
    {
      href: "/app-owner/tenants/new",
      label: t("quickCreateTenant"),
      icon: Building2,
    },
    {
      href: "/app-owner/plans/new",
      label: t("quickNewPlan"),
      icon: CreditCard,
    },
    {
      href: "/app-owner/specialties/new",
      label: t("quickAddSpecialty"),
      icon: Stethoscope,
    },
    {
      href: "/app-owner/notifications",
      label: t("quickSendAnnouncement"),
      icon: Bell,
    },
  ];

  return (
    <FadeInStagger className="space-y-6">
      <FadeInItem>
        <AppOwnerPageHeader
          eyebrow={tLayout("platformAdmin")}
          title={t("overviewTitle")}
          description={t("overviewSubtitle")}
          actions={
            <>
              <Button variant="outline" asChild>
                <Link href="/app-owner/plans/new">
                  <Plus className="me-2 h-4 w-4" />
                  {tPlans("newButton")}
                </Link>
              </Button>
              <Button asChild>
                <Link href="/app-owner/tenants/new">
                  <Plus className="me-2 h-4 w-4" />
                  {tTenants("createTenant")}
                </Link>
              </Button>
            </>
          }
        />
      </FadeInItem>

      {/* KPI Strip */}
      <FadeInItem>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Link
            href="/app-owner/tenants?tab=requests"
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              title={t("pendingRequests")}
              value={metrics.pendingRequests}
              icon={Clock}
              className={cn(
                "h-full transition-colors hover:border-primary/60",
                metrics.pendingRequests > 0 && "ring-1 ring-accent-yellow/40",
              )}
            />
          </Link>

          <Link
            href="/app-owner/tenants"
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              title={t("totalTenants")}
              value={metrics.totalTenants}
              icon={Building2}
              className="h-full transition-colors hover:border-primary/60"
            />
          </Link>

          <Link
            href="/app-owner/tenants?tab=active"
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              title={t("activeSubscriptions")}
              value={metrics.activeSubscriptions}
              icon={CreditCard}
              className="h-full transition-colors hover:border-primary/60"
            />
          </Link>

          <StatCard
            title={t("totalUsers")}
            value={metrics.totalUsers}
            icon={Users}
            className="h-full"
          />

          <Link
            href="/app-owner/plans"
            className="block rounded-[var(--radius-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <StatCard
              title={t("activePlans")}
              value={metrics.plansCount}
              icon={Activity}
              className="h-full transition-colors hover:border-primary/60"
            />
          </Link>
        </div>
      </FadeInItem>

      {/* Main 12-Column Command Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Actionable Pending Requests Queue */}
        <FadeInItem className="min-w-0 lg:col-span-7">
          <Card elevated cornerAccent className="h-full">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle>{t("pendingQueueTitle")}</CardTitle>
                  {metrics.pendingRequests > 0 && (
                    <Badge
                      variant="secondary"
                      className="bg-accent-yellow-soft text-accent-yellow border-0 tabular-nums"
                    >
                      {metrics.pendingRequests}
                    </Badge>
                  )}
                </div>
                <CardDescription>{t("pendingQueueDesc")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="shrink-0">
                <Link href="/app-owner/tenants?tab=requests">
                  <span>{tCommon("viewAll")}</span>
                  <ArrowUpRight className="ms-1 h-4 w-4 rtl:-scale-x-100" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent>
              {pendingQueue.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-[var(--radius-button)] border border-dashed border-hairline bg-canvas-soft/60 px-6 py-12 text-center dark:bg-surface-elevated/40">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-accent-green-soft text-accent-green">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {t("allCaughtUp")}
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    {t("allCaughtUpDesc")}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-hairline-soft dark:divide-hairline">
                  {pendingQueue.map((item) => {
                    const formattedDate = new Date(
                      item.created_at,
                    ).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });
                    const contactEmail = item.owner?.email || item.email;

                    return (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-foreground">
                              {item.name}
                            </span>
                            <StatusBadge status={item.status} />
                            {item.request_ref && (
                              <span className="rounded-[var(--radius-input)] border border-hairline bg-canvas-soft px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground dark:bg-surface-elevated">
                                {item.request_ref}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            {contactEmail && (
                              <span className="truncate">{contactEmail}</span>
                            )}
                            {item.initialSubscription?.plan_name && (
                              <Badge variant="outline" className="text-[11px]">
                                {item.initialSubscription.plan_name}
                              </Badge>
                            )}
                            <span className="tabular-nums">
                              {t("submittedOn", { date: formattedDate })}
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0">
                          <TenantApprovalDialog
                            tenant={{
                              id: item.id,
                              name: item.name,
                              status: item.status,
                              request_ref: item.request_ref,
                              created_at: item.created_at,
                              email: item.email,
                              phone: item.phone,
                            }}
                            owner={item.owner}
                            initialSubscription={item.initialSubscription}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </FadeInItem>

        {/* Right: Analytics + Quick Actions */}
        <FadeInItem className="min-w-0 space-y-6 lg:col-span-5">
          <Card elevated cornerAccent>
            <CardHeader>
              <CardTitle>{t("tenantMixTitle")}</CardTitle>
              <CardDescription>{t("tenantMixDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {tenantMixData.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("noChartData")}
                </p>
              ) : (
                <div className="space-y-4">
                  <ChartContainer
                    config={tenantMixConfig}
                    className="h-[180px] w-full aspect-auto"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Pie
                        data={tenantMixData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={48}
                        outerRadius={74}
                        strokeWidth={2}
                      >
                        {tenantMixData.map((entry) => (
                          <Cell key={entry.key} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="grid grid-cols-3 gap-2 border-t border-hairline-soft pt-3 text-center dark:border-hairline">
                    {tenantMixData.map((entry) => (
                      <div key={entry.key} className="min-w-0 space-y-0.5">
                        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                          <span
                            className="h-2 w-2 shrink-0 rounded-[2px]"
                            style={{ backgroundColor: entry.fill }}
                          />
                          <span className="truncate">{entry.label}</span>
                        </div>
                        <p className="text-base font-bold tabular-nums text-foreground">
                          {entry.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {planAdoption.length > 0 && (
                <div className="space-y-3 border-t border-hairline-soft pt-4 dark:border-hairline">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      {t("planAdoptionTitle")}
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      {t("planAdoptionDesc")}
                    </p>
                  </div>
                  <ChartContainer
                    config={planChartConfig}
                    className="h-[160px] w-full aspect-auto"
                  >
                    <BarChart
                      data={planAdoption}
                      layout="vertical"
                      margin={{ top: 0, right: 12, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tickLine={false}
                        axisLine={false}
                        width={90}
                        tick={{ fontSize: 11 }}
                      />
                      <XAxis type="number" allowDecimals={false} hide />
                      <ChartTooltip
                        cursor={{ fill: "var(--muted)", opacity: 0.35 }}
                        content={<ChartTooltipContent hideLabel />}
                      />
                      <Bar
                        dataKey="subscribers"
                        fill="var(--chart-1)"
                        radius={[0, 4, 4, 0]}
                        barSize={18}
                      />
                    </BarChart>
                  </ChartContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <Card elevated>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                {tCommon("quickActions")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {quickActions.map((action) => (
                  <Button
                    key={action.href}
                    variant="outline"
                    asChild
                    className="h-auto justify-start gap-2.5 px-3.5 py-3 text-start"
                  >
                    <Link href={action.href}>
                      <action.icon className="h-4 w-4 shrink-0 text-primary" />
                      <span className="truncate text-sm font-medium">
                        {action.label}
                      </span>
                    </Link>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeInItem>
      </div>
    </FadeInStagger>
  );
}
