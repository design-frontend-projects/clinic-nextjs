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

function doctorName(profiles?: { full_name: string | null } | null): string {
  return profiles?.full_name ? `Dr. ${profiles.full_name}` : "—";
}

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Appointments</h1>
        <p className="text-muted-foreground">
          Upcoming appointments and your visit history.
        </p>
      </div>

      <Tabs defaultValue="upcoming" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
          <TabsTrigger value="history">Visit History</TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {upcoming.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground">
                    No upcoming appointments.
                  </TableCell>
                </TableRow>
              ) : (
                upcoming.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>
                      {format(new Date(a.appointment_date), "PPp")}
                    </TableCell>
                    <TableCell>{doctorName(a.profiles)}</TableCell>
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
              Encounters
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Diagnosis</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history || history.encounters.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No past visits recorded.
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
                      <TableCell>{doctorName(e.profiles)}</TableCell>
                      <TableCell>{e.diagnosis || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Past Appointments
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date &amp; Time</TableHead>
                  <TableHead>Doctor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Rating</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!history || history.pastAppointments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No past appointments.
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
                        <TableCell>{doctorName(a.profiles)}</TableCell>
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
                              Rate
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
