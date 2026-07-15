"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Star } from "lucide-react";
import {
  getMyUpcomingAppointments,
  getMyVisitHistory,
} from "@/app/actions/patient";
import { getMyReviews } from "@/app/actions/reviews";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { RateAppointmentDialog } from "@/components/patient/rate-appointment-dialog";
import { useTranslations } from "next-intl";

function ReviewStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating}/5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={
            i < rating
              ? "h-3.5 w-3.5 fill-fin text-fin"
              : "h-3.5 w-3.5 text-muted-foreground/40"
          }
        />
      ))}
    </span>
  );
}

export default function PatientAppointmentsPage() {
  const t = useTranslations("pages.patient.appointments");
  const [ratingAppointmentId, setRatingAppointmentId] = useState<string | null>(null);

  const { data: upcoming = [] } = useQuery({
    queryKey: ["my-upcoming-appointments"],
    queryFn: () => getMyUpcomingAppointments(),
  });

  const { data: history } = useQuery({
    queryKey: ["my-visit-history"],
    queryFn: () => getMyVisitHistory(),
  });

  const { data: myReviews = [] } = useQuery({
    queryKey: ["my-reviews"],
    queryFn: () => getMyReviews(),
  });

  const reviewByAppointment = new Map(
    myReviews.map((review) => [review.appointment_id, review]),
  );

  function getDoctorName(profiles?: { full_name: string | null } | null): string {
    return profiles?.full_name ? t("doctorPrefix", { name: profiles.full_name }) : "—";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">
          {t("subtitle")}
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">{t("tabUpcoming")}</TabsTrigger>
          <TabsTrigger value="history">{t("tabHistory")}</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colDateTime")}</TableHead>
                <TableHead>{t("colDoctor")}</TableHead>
                <TableHead>{t("colStatus")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    {t("noUpcoming")}
                  </TableCell>
                </TableRow>
              ) : (
                upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(new Date(a.appointment_date), "PPp")}
                    </TableCell>
                    <TableCell>{getDoctorName(a.profiles)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="history" className="mt-4 space-y-8">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("encounters")}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead>{t("colType")}</TableHead>
                  <TableHead>{t("colDoctor")}</TableHead>
                  <TableHead>{t("colDiagnosis")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history || history.encounters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("noPastVisits")}
                    </TableCell>
                  </TableRow>
                ) : (
                  history.encounters.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>
                        {format(new Date(e.encounter_date), "PP")}
                      </TableCell>
                      <TableCell className="capitalize">
                        {e.encounter_type || "—"}
                      </TableCell>
                      <TableCell>{getDoctorName(e.profiles)}</TableCell>
                      <TableCell>{e.diagnosis || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {t("pastAppointments")}
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDateTime")}</TableHead>
                  <TableHead>{t("colDoctor")}</TableHead>
                  <TableHead>{t("colStatus")}</TableHead>
                  <TableHead>{t("colRating")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history || history.pastAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {t("noPastAppointments")}
                    </TableCell>
                  </TableRow>
                ) : (
                  history.pastAppointments.map((a) => {
                    const review = reviewByAppointment.get(a.id);
                    return (
                      <TableRow key={a.id}>
                        <TableCell>
                          {format(new Date(a.appointment_date), "PPp")}
                        </TableCell>
                        <TableCell>{getDoctorName(a.profiles)}</TableCell>
                        <TableCell>
                          <StatusBadge status={a.status} />
                        </TableCell>
                        <TableCell>
                          {review ? (
                            <span className="flex items-center gap-2">
                              <ReviewStars rating={review.rating} />
                              <StatusBadge status={review.status} />
                            </span>
                          ) : a.status === "completed" ? (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setRatingAppointmentId(a.id)}
                            >
                              <Star className="me-1.5 h-3.5 w-3.5" />
                              {t("rateButton")}
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <RateAppointmentDialog
        appointmentId={ratingAppointmentId}
        onOpenChange={(open) => {
          if (!open) setRatingAppointmentId(null);
        }}
      />
    </div>
  );
}
