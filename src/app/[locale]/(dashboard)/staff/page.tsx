"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes, format } from "date-fns";
import { Users, CalendarDays, ClipboardList, Wallet, Plus } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis } from "recharts";
import { useTranslations } from "next-intl";

import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
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
import { NewAppointmentDialog } from "@/components/appointments/new-appointment-dialog";
import {
  getStaffDashboardStats,
  createStaffAppointment,
  registerPatientAndCreateStaffAppointment,
} from "@/app/actions/staff";
import type {
  AppointmentStatus,
  StaffDashboardStats,
} from "@/types/staff.types";

const defaultStats: StaffDashboardStats = {
  todaysAppointments: 0,
  completedToday: 0,
  remainingToday: 0,
  checkedInQueue: 0,
  newPatientsToday: 0,
  paymentsCollectedToday: 0,
  queue: [],
  throughput: [],
};

const STATUS_COLORS: Record<AppointmentStatus, string> = {
  scheduled: "var(--color-accent-blue)",
  checked_in: "var(--color-accent-yellow)",
  completed: "var(--color-accent-green)",
  cancelled: "var(--color-accent-red)",
  no_show: "var(--color-muted-foreground)",
};

const STATUS_LABEL_KEY: Record<AppointmentStatus, string> = {
  scheduled: "statusScheduled",
  checked_in: "statusCheckedIn",
  completed: "statusCompleted",
  cancelled: "statusCancelled",
  no_show: "statusNoShow",
};

const INVALIDATE_KEYS = ["staff-dashboard", "staff-queue"];

export default function StaffDashboard() {
  const t = useTranslations("pages.staff");
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: stats = defaultStats } = useQuery({
    queryKey: ["staff-dashboard"],
    queryFn: () => getStaffDashboardStats(),
  });

  const chartConfig: ChartConfig = { count: { label: t("appointments") } };
  const chartData = stats.throughput.map((point) => ({
    label: t(STATUS_LABEL_KEY[point.status]),
    count: point.count,
    fill: STATUS_COLORS[point.status],
  }));
  const hasThroughput = stats.throughput.some((point) => point.count > 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {t("newAppointment")}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("todaysAppointments")}
          value={stats.todaysAppointments}
          icon={CalendarDays}
          description={`${stats.completedToday} ${t("completed")}, ${stats.remainingToday} ${t("remaining")}`}
        />
        <StatCard
          title={t("checkedInQueue")}
          value={stats.checkedInQueue}
          icon={ClipboardList}
          description={t("waitingForDoctors")}
        />
        <StatCard
          title={t("newPatients")}
          value={stats.newPatientsToday}
          icon={Users}
          description={t("registeredToday")}
        />
        <StatCard
          title={t("paymentsCollected")}
          value={`$${stats.paymentsCollectedToday.toLocaleString(undefined, {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
          })}`}
          icon={Wallet}
          description={t("collectedToday")}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("currentQueue")}</CardTitle>
            <CardDescription>{t("patientsWaiting")}</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.queue.length === 0 ? (
              <div className="flex h-[160px] items-center justify-center rounded-lg border border-dashed">
                <p className="text-sm text-muted-foreground">
                  {t("queueEmpty")}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {stats.queue.map((item) => {
                  const waitMins =
                    item.status === "checked_in" && item.checkedInAt
                      ? Math.max(
                          differenceInMinutes(
                            new Date(),
                            new Date(item.checkedInAt),
                          ),
                          0,
                        )
                      : null;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div>
                        <p className="font-medium">{item.patientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.doctorName} •{" "}
                          {format(new Date(item.appointmentDate), "h:mm a")}
                        </p>
                      </div>
                      <div className="text-right">
                        <StatusBadge status={item.status} />
                        {waitMins !== null && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t("waiting")}: {waitMins} {t("minsShort")}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("quickInsights")}</CardTitle>
            <CardDescription>
              {format(new Date(), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {hasThroughput ? (
              <ChartContainer config={chartConfig} className="h-[200px] w-full">
                <BarChart accessibilityLayer data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                  <Bar dataKey="count" radius={4}>
                    {chartData.map((entry) => (
                      <Cell key={entry.label} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            ) : (
              <div className="mt-4 flex h-[200px] items-center justify-center border-t border-dashed">
                <p className="text-sm text-muted-foreground">
                  {t("noThroughput")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <NewAppointmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateAppointment={createStaffAppointment}
        onRegisterPatient={registerPatientAndCreateStaffAppointment}
        invalidateKeys={INVALIDATE_KEYS}
      />
    </div>
  );
}
