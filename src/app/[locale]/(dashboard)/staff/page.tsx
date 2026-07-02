import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Users, CalendarDays, ClipboardList, Wallet } from "lucide-react";
import { format } from "date-fns";

export default function StaffDashboard() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Staff Operations</h1>
        <p className="text-muted-foreground">
          View today&apos;s activity, queue, and collections.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Today's Appointments"
          value={42}
          icon={CalendarDays}
          description="18 completed, 24 remaining"
        />
        <StatCard
          title="Checked-In Queue"
          value={8}
          icon={ClipboardList}
          description="Waiting for doctors"
        />
        <StatCard
          title="New Patients"
          value={12}
          icon={Users}
          description="Registered today"
        />
        <StatCard
          title="Payments Collected"
          value="$2,450"
          icon={Wallet}
          description="Across 14 transactions"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Waiting Queue */}
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>Current Queue</CardTitle>
            <CardDescription>
              Patients waiting to be seen by doctors
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dummy Queue Items */}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Sarah Jenkins</p>
                  <p className="text-sm text-muted-foreground">
                    Dr. Smith • General Checkup
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting: 14 mins
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Michael Chang</p>
                  <p className="text-sm text-muted-foreground">
                    Dr. Adams • Cardiology
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting: 8 mins
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">Emma Wilson</p>
                  <p className="text-sm text-muted-foreground">
                    Dr. Smith • Follow-up
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    Waiting: 2 mins
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Insights */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Insights</CardTitle>
            <CardDescription>
              {format(new Date(), "MMMM d, yyyy")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-center justify-center border-t border-dashed mt-4 bg-slate-50/50 dark:bg-slate-900/20">
              <p className="text-sm text-muted-foreground">
                Daily throughput chart
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
