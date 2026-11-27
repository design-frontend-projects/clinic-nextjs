"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/routing";
import { format } from "date-fns";
import { CalendarDays, User, Clock, CalendarPlus, ArrowUpRight, Activity } from "lucide-react";
import {
  getMyPatientRecord,
  getMyUpcomingAppointments,
} from "@/app/actions/patient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function PatientDashboardPage() {
  const t = useTranslations("pages.patient.dashboard");

  const { data: record } = useQuery({
    queryKey: ["my-patient-record"],
    queryFn: () => getMyPatientRecord(),
  });

  const { data: upcoming = [], isLoading } = useQuery({
    queryKey: ["my-upcoming-appointments"],
    queryFn: () => getMyUpcomingAppointments(),
  });

  const nextAppointment = upcoming[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {record?.profile?.full_name ? t("welcomeWithName", { name: record.profile.full_name }) : t("welcome")}
          </h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/booking?action=new">
            <CalendarPlus className="me-2 h-4 w-4" />
            {t("bookAppointment")}
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("nextAppointment")}</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">{t("loading")}</p>
            ) : nextAppointment ? (
              <div className="space-y-3">
                <div className="space-y-1">
                  <p className="text-lg font-semibold">
                    {format(new Date(nextAppointment.appointment_date), "PPp")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {nextAppointment.profiles?.full_name
                      ? `Dr. ${nextAppointment.profiles.full_name}`
                      : t("doctorUnassigned")}
                  </p>
                  <StatusBadge status={nextAppointment.status} />
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/booking?id=${nextAppointment.id}`}>
                    {t("manageBooking")}
                    <ArrowUpRight className="ms-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("noUpcomingAppointments")}
                </p>
                <Button asChild variant="outline" size="sm">
                  <Link href="/booking?action=new">
                    <CalendarPlus className="me-1.5 h-3.5 w-3.5" />
                    {t("bookAppointment")}
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("quickLinks")}</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/booking">
                <CalendarDays className="me-2 h-4 w-4" />
                {t("linkBookings")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/patient/appointments">
                <Clock className="me-2 h-4 w-4" />
                {t("linkAppointments")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/patient/reports">
                <Activity className="me-2 h-4 w-4" />
                {t("linkBodyReports")}
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/profile">
                <User className="me-2 h-4 w-4" />
                {t("linkProfile")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
