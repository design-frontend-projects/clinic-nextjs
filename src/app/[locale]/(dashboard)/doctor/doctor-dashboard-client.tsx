"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Users,
  CalendarDays,
  FlaskConical,
  Clock,
  ChevronRight,
  CheckCircle2,
  Calendar,
  Activity,
  ArrowUpRight,
  Star,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { StarRating } from "@/components/ui/star-rating";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DoctorReview, DoctorReviewStats } from "@/types/review.types";
import { useTranslations } from "next-intl";

interface Appointment {
  id: string;
  patientId: string | null;
  patientName: string;
  date: string;
  status: string;
  notes: string | null;
}

interface Patient {
  id?: string;
  name: string;
  phone?: string | null;
  lastVisit?: string;
}

interface DashboardStats {
  todayCount: number;
  pendingLabCount: number;
  todayAppointments: Appointment[];
  recentPatients: Patient[];
}

interface DoctorDashboardClientProps {
  stats: DashboardStats;
  reviewStats: DoctorReviewStats;
  recentReviews: DoctorReview[];
}

// Framer Motion Animation Variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } },
} as const;


export function DoctorDashboardClient({
  stats,
  reviewStats,
  recentReviews,
}: DoctorDashboardClientProps) {
  const t = useTranslations("pages.doctor");
  const todayDateStr = format(new Date(), "EEEE, MMM d, yyyy");

  // Calculate schedule completion stats
  const totalAppts = stats.todayAppointments.length;
  const completedAppts = stats.todayAppointments.filter(
    (a) => a.status === "completed"
  ).length;
  const completionPercentage = totalAppts > 0 ? Math.round((completedAppts / totalAppts) * 100) : 0;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      {/* Premium Header/Greeting Section */}
      <motion.div variants={itemVariants} className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-bold tracking-tight bg-gradient-to-r from-foreground via-muted-foreground to-foreground bg-clip-text text-transparent">
            {t("title")}
          </h1>
          <p className="text-muted-foreground font-medium mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/60 backdrop-blur-md border border-border/40 shadow-sm">
          <Calendar className="h-4 w-4 text-accent-blue" />
          <span className="text-sm font-semibold">{todayDateStr}</span>
        </div>
      </motion.div>

      {/* Completion Tracker Widget */}
      {totalAppts > 0 && (
        <motion.div variants={itemVariants}>
          <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-6 backdrop-blur-md shadow-sm">
            <div className="absolute top-0 right-0 p-3 opacity-10">
              <CheckCircle2 className="h-24 w-24 text-accent-green" />
            </div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Activity className="h-5 w-5 text-accent-green animate-pulse" />
                  {t("scheduleProgress")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {t("scheduleProgressDesc", { completed: completedAppts, total: totalAppts })}
                </p>
              </div>
              <div className="w-full md:w-64 space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>{t("completionRate")}</span>
                  <span className="text-accent-green font-bold">{completionPercentage}%</span>
                </div>
                <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-accent-green"
                    initial={{ width: 0 }}
                    animate={{ width: `${completionPercentage}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats Cards Section */}
      <motion.div
        variants={containerVariants}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        {/* Today's Appointments Card */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-md shadow-sm hover:shadow-md hover:border-border transition-all"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <CalendarDays className="h-32 w-32" />
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-muted-foreground">{t("todaysAppointments")}</span>
              <h2 className="text-4xl font-extrabold tracking-tight">{stats.todayCount}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t("scheduledForConsultation")}</p>
            </div>
            <div className="rounded-xl p-3 bg-accent-blue-soft text-accent-blue">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
        </motion.div>

        {/* Pending Lab Reviews Card */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-md shadow-sm hover:shadow-md hover:border-border transition-all"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <FlaskConical className="h-32 w-32" />
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-muted-foreground">{t("pendingLabs")}</span>
              <h2 className="text-4xl font-extrabold tracking-tight">{stats.pendingLabCount}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t("pendingLabsDesc")}</p>
            </div>
            <div className="rounded-xl p-3 bg-accent-yellow-soft text-accent-yellow">
              <FlaskConical className="h-6 w-6" />
            </div>
          </div>
        </motion.div>

        {/* Patients Recently Seen Card */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-md shadow-sm hover:shadow-md hover:border-border transition-all"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Users className="h-32 w-32" />
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-muted-foreground">{t("recentPatients")}</span>
              <h2 className="text-4xl font-extrabold tracking-tight">{stats.recentPatients.length}</h2>
              <p className="text-xs text-muted-foreground mt-1">{t("recentPatientsDesc")}</p>
            </div>
            <div className="rounded-xl p-3 bg-accent-green-soft text-accent-green">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </motion.div>

        {/* Average Rating Card */}
        <motion.div
          variants={itemVariants}
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2 }}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/60 p-6 backdrop-blur-md shadow-sm hover:shadow-md hover:border-border transition-all"
        >
          <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-300">
            <Star className="h-32 w-32" />
          </div>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <span className="text-sm font-semibold text-muted-foreground">{t("averageRating")}</span>
              <h2 className="text-4xl font-extrabold tracking-tight">
                {reviewStats.count ? reviewStats.average : "—"}
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                {t("approvedReviewsCount", { count: reviewStats.count })}
              </p>
            </div>
            <div className="rounded-xl p-3 bg-accent-yellow-soft text-accent-yellow">
              <Star className="h-6 w-6" />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Grid: Schedule and Recently Consulted */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Today's Schedule Card */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/40 bg-card/50 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Clock className="h-5 w-5 text-accent-blue" />
                  {t("todaysSchedule")}
                </CardTitle>
                <CardDescription>{t("appointmentsForToday")}</CardDescription>
              </div>
              <Link href="/doctor/appointments">
                <Button variant="outline" size="sm" className="rounded-xl font-medium border-border hover:bg-muted/80">
                  {t("viewSchedule")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats.todayAppointments.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("noAppointments")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.todayAppointments.map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between rounded-xl border border-border/30 bg-card/30 p-4 hover:bg-card/85 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center justify-center rounded-lg bg-accent-blue-soft px-3 py-1.5 text-accent-blue font-semibold">
                          <span className="text-sm">
                            {format(new Date(apt.date), "HH:mm")}
                          </span>
                        </div>
                        <div>
                          <p className="font-semibold text-sm group-hover:text-accent-blue transition-colors">
                            {apt.patientName || t("unknownPatient")}
                          </p>
                          {apt.notes && (
                            <p className="text-xs text-muted-foreground truncate w-40 md:w-56 mt-0.5">
                              {apt.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={apt.status} />
                        {apt.patientId && (
                          <Link
                            href={
                              apt.status !== "completed"
                                ? `/doctor/patients/${apt.patientId}?appointmentId=${apt.id}`
                                : `/doctor/patients/${apt.patientId}`
                            }
                          >
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-lg text-muted-foreground hover:text-accent-blue hover:bg-accent-blue-soft transition-colors"
                              title={apt.status !== "completed" ? t("startConsultation") : t("viewFile")}
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Recently Consulted Card */}
        <motion.div variants={itemVariants}>
          <Card className="border border-border/40 bg-card/50 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-accent-green" />
                  {t("recentPatients")}
                </CardTitle>
                <CardDescription>{t("quickAccess")}</CardDescription>
              </div>
              <Link href="/doctor/patients">
                <Button variant="outline" size="sm" className="rounded-xl font-medium border-border hover:bg-muted/80">
                  {t("viewAll")}
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              {stats.recentPatients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">{t("noRecentPatients")}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {stats.recentPatients.map((patient) => (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between rounded-xl border border-border/30 bg-card/30 p-4 hover:bg-card/85 transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-green-soft text-accent-green font-semibold">
                          {patient.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-sm group-hover:text-accent-green transition-colors">
                            {patient.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t("lastVisit")}:{" "}
                            {patient.lastVisit
                              ? format(new Date(patient.lastVisit), "MMM d, yyyy")
                              : t("unknown")}
                          </p>
                        </div>
                      </div>
                      {patient.id && (
                        <Link href={`/doctor/patients/${patient.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg text-accent-green font-semibold hover:bg-accent-green-soft hover:text-accent-green flex items-center gap-1"
                          >
                            {t("file")}
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Patient Reviews Card */}
      <motion.div variants={itemVariants}>
        <Card className="border border-border/40 bg-card/50 backdrop-blur-md shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Star className="h-5 w-5 text-accent-yellow" />
                {t("patientReviews")}
              </CardTitle>
              <CardDescription>{t("patientReviewsDesc")}</CardDescription>
            </div>
            <Link href="/doctor/reviews">
              <Button variant="outline" size="sm" className="rounded-xl font-medium border-border hover:bg-muted/80">
                {t("viewAll")}
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentReviews.length === 0 ? (
              <div className="text-center py-12">
                <Star className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">{t("noReviews")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentReviews.map((review) => (
                  <div
                    key={review.id}
                    className="flex items-center justify-between rounded-xl border border-border/30 bg-card/30 p-4 hover:bg-card/85 transition-colors gap-4"
                  >
                    <div className="min-w-0 space-y-1">
                      <StarRating rating={review.rating} />
                      {review.comment && (
                        <p className="text-sm text-muted-foreground truncate max-w-md mt-1">
                          {review.comment}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground shrink-0">
                      <p className="font-semibold text-foreground">{review.patient_name}</p>
                      <p className="mt-0.5">
                        {format(new Date(review.created_at), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
