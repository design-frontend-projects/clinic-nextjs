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
import { useTranslations } from "next-intl";

export default function StaffDashboard() {
  const t = useTranslations("pages.staff");
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title={t("todaysAppointments")}
          value={42}
          icon={CalendarDays}
          description={`${t("completed")}, 24 ${t("remaining")}`}
        />
        <StatCard
          title={t("checkedInQueue")}
          value={8}
          icon={ClipboardList}
          description={t("waitingForDoctors")}
        />
        <StatCard
          title={t("newPatients")}
          value={12}
          icon={Users}
          description={t("registeredToday")}
        />
        <StatCard
          title={t("paymentsCollected")}
          value="$2,450"
          icon={Wallet}
          description={`${t("acrossTransactions")}`}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="col-span-2">
          <CardHeader>
            <CardTitle>{t("currentQueue")}</CardTitle>
            <CardDescription>
              {t("patientsWaiting")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{t("sarahJenkins")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("drSmith")} • {t("generalCheckup")}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("waiting")}: 14 mins
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{t("michaelChang")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("drAdams")} • {t("cardiology")}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("waiting")}: 8 mins
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <p className="font-medium">{t("emmaWilson")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("drSmith")} • {t("followUp")}
                  </p>
                </div>
                <div className="text-right">
                  <StatusBadge status="active" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("waiting")}: 2 mins
                  </p>
                </div>
              </div>
            </div>
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
