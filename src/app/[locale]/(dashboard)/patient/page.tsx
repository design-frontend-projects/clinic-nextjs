"use client";

import { useQuery } from "@tanstack/react-query";
import { Link } from "@/i18n/routing";
import { format } from "date-fns";
import { CalendarDays, User, Clock } from "lucide-react";
import {
  getMyPatientRecord,
  getMyUpcomingAppointments,
} from "@/app/actions/patient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";

export default function PatientDashboardPage() {
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome{record?.profile?.full_name ? `, ${record.profile.full_name}` : ""}
        </h1>
        <p className="text-muted-foreground">
          Your appointments and visit history at a glance.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Appointment</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : nextAppointment ? (
              <div className="space-y-1">
                <p className="text-lg font-semibold">
                  {format(new Date(nextAppointment.appointment_date), "PPp")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {nextAppointment.profiles?.full_name
                    ? `Dr. ${nextAppointment.profiles.full_name}`
                    : "Doctor to be assigned"}
                </p>
                <StatusBadge status={nextAppointment.status} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No upcoming appointments.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Links</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button asChild variant="outline" className="justify-start">
              <Link href="/patient/appointments">
                <Clock className="mr-2 h-4 w-4" />
                Appointments & Visit History
              </Link>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <Link href="/patient/profile">
                <User className="mr-2 h-4 w-4" />
                My Profile
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
