import { getDoctorDashboardStats } from "@/app/actions/doctor";
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
  CalendarDays,
  FlaskConical,
  Clock,
  ChevronRight,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default async function DoctorDashboard() {
  let stats;
  try {
    stats = await getDoctorDashboardStats();
  } catch {
    stats = {
      todayCount: 0,
      pendingLabCount: 0,
      todayAppointments: [],
      recentPatients: [],
    };
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Doctor Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your daily overview</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Today's Appointments"
          value={stats.todayCount}
          icon={CalendarDays}
          description={format(new Date(), "EEEE, MMM d, yyyy")}
        />
        <StatCard
          title="Pending Labs"
          value={stats.pendingLabCount}
          icon={FlaskConical}
          description="Awaiting review"
        />
        <StatCard
          title="Patients Seen"
          value={stats.recentPatients.length}
          icon={Users}
          description="Recently consulted"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Today&apos;s Schedule
                </CardTitle>
                <CardDescription>
                  Appointments for the current day
                </CardDescription>
              </div>
              <Link href="/doctor/appointments">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {stats.todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No appointments scheduled for today.
              </p>
            ) : (
              <div className="space-y-4">
                {stats.todayAppointments.map((apt: any) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center justify-center rounded-md bg-primary/10 px-2 py-1 text-primary">
                        <span className="text-lg font-bold">
                          {format(new Date(apt.date), "HH:mm")}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {apt.patientName || "Unknown Patient"}
                        </p>
                        {apt.notes && (
                          <p className="text-xs text-muted-foreground truncate w-40">
                            {apt.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={apt.status} />
                      <Link href={`/doctor/patients/${apt.id}`}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Recently Consulted
            </CardTitle>
            <CardDescription>
              Quick access to recent patient files
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentPatients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No recent patients found.
                </p>
              ) : (
                stats.recentPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between rounded-lg border p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                        <Users className="h-4 w-4 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium">{patient.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Last visit:{" "}
                          {patient.lastVisit
                            ? format(new Date(patient.lastVisit), "MMM d, yyyy")
                            : "Unknown"}
                        </p>
                      </div>
                    </div>
                    <Link href={`/doctor/patients/${patient.id}`}>
                      <Button variant="outline" size="sm">
                        File
                      </Button>
                    </Link>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
