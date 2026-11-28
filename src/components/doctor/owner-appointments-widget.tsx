"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ChevronRight, Clock, Tag } from "lucide-react";

import { getDoctorDashboardStats } from "@/app/actions/doctor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Link } from "@/i18n/routing";
import { useLocale, useTranslations } from "next-intl";

/**
 * "My Appointments Today" card for a clinic owner who also practises. Rendered
 * on the admin dashboard; fetches the practitioner stats scoped to the owner's
 * own `doctor_id`. Renders nothing when the owner has no appointments assigned,
 * so non-practising owners never see an empty widget.
 */
export function OwnerAppointmentsWidget() {
  const t = useTranslations("doctor.ownerWidget");
  const tCat = useTranslations("admin.billing.categories");
  const locale = useLocale();
  const { data: stats } = useQuery({
    queryKey: ["owner-appointments-widget"],
    queryFn: () => getDoctorDashboardStats(),
    // Owner may not practise — treat any error as "no data" and hide the card.
    retry: false,
  });

  const appointments = stats?.todayAppointments ?? [];

  if (appointments.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {t("title")}
            </CardTitle>
            <CardDescription>
              {t("description")}
            </CardDescription>
          </div>
          <Link href="/doctor/appointments">
            <Button variant="outline" size="sm">
              {t("viewAll")}
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {appointments.map((apt) => (
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
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {apt.patientName || t("unknownPatient")}
                    </p>
                    {apt.catalogItem && (
                      <Badge
                        variant="secondary"
                        className="inline-flex h-5 items-center gap-1 px-1.5 text-[10px] font-medium"
                      >
                        <Tag className="h-2.5 w-2.5 text-primary" />
                        <span className="max-w-[140px] truncate">
                          {locale === "ar"
                            ? apt.catalogItem.nameAr
                            : apt.catalogItem.nameEn}
                        </span>
                        <span className="text-muted-foreground">
                          · {tCat(apt.catalogItem.category)}
                        </span>
                      </Badge>
                    )}
                  </div>
                  {apt.notes && (
                    <p className="w-40 truncate text-xs text-muted-foreground">
                      {apt.notes}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={apt.status} />
                {apt.patientId && apt.status !== "completed" && (
                  <Link
                    href={`/doctor/patients/${apt.patientId}?appointmentId=${apt.id}`}
                    title={t("startConsultation")}
                  >
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
