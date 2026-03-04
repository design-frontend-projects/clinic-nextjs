"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/app/actions/admin";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Stethoscope,
  CalendarDays,
  CreditCard,
  Clock,
} from "lucide-react";
import { format } from "date-fns";

const defaultStats = {
  totalPatients: 0,
  totalDoctors: 0,
  todayAppointments: 0,
  pendingPayments: 0,
  recentAppointments: [] as {
    id: string;
    patientName: string;
    doctorName: string;
    date: string;
    status: string;
  }[],
};

export default function AdminDashboard() {
  const { data: stats = defaultStats } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your clinic operations
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Patients"
          value={stats.totalPatients}
          icon={Users}
          trend={{ value: 12, positive: true }}
          description="Registered patients"
        />
        <StatCard
          title="Active Doctors"
          value={stats.totalDoctors}
          icon={Stethoscope}
          description="On staff"
        />
        <StatCard
          title="Today's Appointments"
          value={stats.todayAppointments}
          icon={CalendarDays}
          description={format(new Date(), "EEEE, MMM d")}
        />
        <StatCard
          title="Pending Payments"
          value={stats.pendingPayments}
          icon={CreditCard}
          trend={{ value: 3, positive: false }}
          description="Awaiting collection"
        />
      </div>

      {/* Recent Appointments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Appointments
          </CardTitle>
          <CardDescription>Latest appointment activity</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.recentAppointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No appointments yet. Create your first appointment to get started.
            </p>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(stats.recentAppointments || []).map((apt: any) => (
                <div
                  key={apt.id}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {apt.patientName || "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Dr. {apt.doctorName}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {format(new Date(apt.date), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(apt.date), "h:mm a")}
                      </p>
                    </div>
                    <StatusBadge status={apt.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
