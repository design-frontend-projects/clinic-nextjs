"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { differenceInYears, format } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  Check,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  canManagePatientPasswords,
  getPatientOverview,
  resetPatientPassword,
  setPatientPassword,
} from "@/app/actions/patient";
import type { TempPasswordInfo } from "@/components/admin/temp-password-dialog";
import { InviteToPortalButton } from "@/components/patients/invite-to-portal-button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  buildSetPatientPasswordSchema,
  type PatientRow,
  type SetPatientPasswordInput,
} from "@/types/patient.types";

export interface PatientDetailsDialogProps {
  patient: PatientRow | null;
  onOpenChange: (open: boolean) => void;
  onInvited: (info: TempPasswordInfo) => void;
  onPasswordGenerated: (info: TempPasswordInfo) => void;
}

type DetailsTab = "overview" | "visits" | "account";

function getInitials(firstName?: string | null, lastName?: string | null): string {
  const first = firstName?.trim().charAt(0) ?? "";
  const last = lastName?.trim().charAt(0) ?? "";
  const combined = `${first}${last}`.toUpperCase();
  return combined || "PT";
}

function safeFormatDate(
  value: Date | string | null | undefined,
  pattern: string,
): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return format(date, pattern);
}

/**
 * Rich, read-only patient profile modal with Overview, Visits timeline, and
 * Account management tabs. Owners and doctors can generate temporary portal
 * passwords or set a custom password for patients with active portal logins.
 */
export function PatientDetailsDialog({
  patient,
  onOpenChange,
  onInvited,
  onPasswordGenerated,
}: PatientDetailsDialogProps) {
  const t = useTranslations("patients.details");
  const tGender = useTranslations("enums.gender");
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<DetailsTab>("overview");
  const [copiedField, setCopiedField] = useState<"phone" | "email" | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isResetting, startResetTransition] = useTransition();
  const [isSavingPassword, startSaveTransition] = useTransition();

  const passwordSchema = useMemo(
    () =>
      buildSetPatientPasswordSchema({
        minLength: t("errMinLength"),
        maxLength: t("errMaxLength"),
        complexity: t("errComplexity"),
        confirmRequired: t("errConfirmRequired"),
        mismatch: t("errMismatch"),
      }),
    [t],
  );

  const form = useForm<SetPatientPasswordInput>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const patientId = patient?.id ?? null;

  useEffect(() => {
    setActiveTab("overview");
    setShowPassword(false);
    setShowConfirm(false);
    setCopiedField(null);
    form.reset({ password: "", confirm: "" });
  }, [patientId, form]);

  const overviewQuery = useQuery({
    queryKey: ["patient-overview", patientId],
    queryFn: () => getPatientOverview(patientId!),
    enabled: Boolean(patientId),
  });

  const canManageQuery = useQuery({
    queryKey: ["can-manage-patient-passwords"],
    queryFn: () => canManagePatientPasswords(),
    staleTime: 5 * 60 * 1000,
    enabled: Boolean(patientId),
  });

  const displayPatient = overviewQuery.data?.patient ?? patient;
  const fullName = displayPatient
    ? `${displayPatient.first_name ?? ""} ${displayPatient.last_name ?? ""}`.trim() ||
      t("title")
    : "";

  const age = useMemo(() => {
    if (!displayPatient?.date_of_birth) return null;
    const dob =
      displayPatient.date_of_birth instanceof Date
        ? displayPatient.date_of_birth
        : new Date(displayPatient.date_of_birth);
    if (Number.isNaN(dob.getTime())) return null;
    const yrs = differenceInYears(new Date(), dob);
    return yrs >= 0 ? yrs : null;
  }, [displayPatient?.date_of_birth]);

  const hasPortal = Boolean(
    overviewQuery.data?.portal.hasAccount ?? displayPatient?.profile_id,
  );
  const canManagePasswords = Boolean(canManageQuery.data);

  const visits = useMemo(() => {
    const overview = overviewQuery.data;
    if (!overview) return [];
    const items = [
      ...overview.recentAppointments.map((appt) => ({
        id: `appt-${appt.id}`,
        kind: "appointment" as const,
        date: appt.appointment_date,
        title: t("appointment"),
        badge: appt.status,
        doctorName: appt.doctorName,
        detail: appt.notes,
      })),
      ...overview.recentEncounters.map((enc) => ({
        id: `enc-${enc.id}`,
        kind: "encounter" as const,
        date: enc.encounter_date,
        title: enc.encounter_type || t("encounter"),
        badge: t("encounter"),
        doctorName: enc.doctorName,
        detail: enc.diagnosis || enc.notes,
      })),
    ];
    return items.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );
  }, [overviewQuery.data, t]);

  const passwordValue = form.watch("password") ?? "";
  const passwordChecks = useMemo(
    () => ({
      minLength: passwordValue.length >= 8,
      hasLetter: /[A-Za-z]/.test(passwordValue),
      hasNumber: /\d/.test(passwordValue),
    }),
    [passwordValue],
  );

  const handleCopy = async (field: "phone" | "email", value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast.success(t("copied"));
      setTimeout(() => setCopiedField(null), 1800);
    } catch {
      toast.error(t("copyFailed"));
    }
  };

  const handleGenerateTempPassword = () => {
    if (!displayPatient) return;
    startResetTransition(async () => {
      const result = await resetPatientPassword(displayPatient.id);
      if ("error" in result) {
        toast.error(result.error || t("passwordResetFailed"));
        return;
      }
      onPasswordGenerated({
        tempPassword: result.tempPassword,
        fullName,
        email: overviewQuery.data?.portal.email ?? displayPatient.email,
        phone: displayPatient.phone,
      });
    });
  };

  const handleSetCustomPassword = (values: SetPatientPasswordInput) => {
    if (!displayPatient) return;
    startSaveTransition(async () => {
      const result = await setPatientPassword(displayPatient.id, values);
      if ("error" in result) {
        toast.error(result.error || t("passwordResetFailed"));
        return;
      }
      toast.success(t("passwordUpdated"));
      form.reset({ password: "", confirm: "" });
      setShowPassword(false);
      setShowConfirm(false);
    });
  };

  if (!patient) return null;

  const dobFormatted = safeFormatDate(displayPatient?.date_of_birth, "MMM d, yyyy");
  const registeredFormatted = safeFormatDate(
    displayPatient?.created_at,
    "MMM d, yyyy",
  );
  const lastSignInFormatted = safeFormatDate(
    overviewQuery.data?.portal.lastSignInAt,
    "MMM d, yyyy · HH:mm",
  );

  return (
    <Dialog open={Boolean(patient)} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Creative Gradient Profile Header */}
        <DialogHeader className="border-b border-hairline bg-linear-to-br from-primary/15 via-primary/5 to-transparent px-5 py-5 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3.5 text-start">
              <Avatar className="h-14 w-14 border-2 border-primary/25 shadow-sm">
                <AvatarFallback className="bg-primary/15 text-base font-bold text-primary">
                  {getInitials(
                    displayPatient?.first_name,
                    displayPatient?.last_name,
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 space-y-1">
                <DialogTitle className="truncate text-lg sm:text-xl">
                  {fullName}
                </DialogTitle>
                <DialogDescription className="truncate text-xs sm:text-sm">
                  {displayPatient?.email ||
                    displayPatient?.phone ||
                    t("notProvided")}
                </DialogDescription>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {age !== null && (
                    <Badge variant="secondary" className="tabular-nums">
                      {t("ageYears", { age })}
                    </Badge>
                  )}
                  {displayPatient?.gender && (
                    <Badge variant="outline" className="capitalize">
                      {tGender(displayPatient.gender.toLowerCase())}
                    </Badge>
                  )}
                  <Badge
                    variant={hasPortal ? "info" : "default"}
                    className={cn(
                      hasPortal &&
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    <ShieldCheck className="h-3 w-3" />
                    {hasPortal ? t("portalActive") : t("noPortal")}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Quick Stat Pills */}
            <div className="flex shrink-0 items-center gap-2 self-start sm:self-center">
              <div className="rounded-lg border border-hairline bg-surface/80 px-3 py-1.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t("appointmentsCount")}
                </p>
                <p className="text-base font-bold tabular-nums">
                  {overviewQuery.isLoading
                    ? "—"
                    : (overviewQuery.data?.counts.appointments ?? 0)}
                </p>
              </div>
              <div className="rounded-lg border border-hairline bg-surface/80 px-3 py-1.5 text-center">
                <p className="text-[11px] font-medium text-muted-foreground">
                  {t("encountersCount")}
                </p>
                <p className="text-base font-bold tabular-nums">
                  {overviewQuery.isLoading
                    ? "—"
                    : (overviewQuery.data?.counts.encounters ?? 0)}
                </p>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as DetailsTab)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="border-b border-hairline bg-surface px-5 py-2.5 sm:px-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" className="gap-1.5">
                <User className="h-3.5 w-3.5" />
                <span>{t("tabs.overview")}</span>
              </TabsTrigger>
              <TabsTrigger value="visits" className="gap-1.5">
                <Stethoscope className="h-3.5 w-3.5" />
                <span>{t("tabs.visits")}</span>
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                <span>{t("tabs.account")}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: "easeOut" }}
              >
                <TabsContent value="overview" className="mt-0 space-y-4">
                  {overviewQuery.isError && (
                    <div
                      role="alert"
                      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                    >
                      {t("loadError")}
                    </div>
                  )}

                  {/* Personal Details Card */}
                  <div className="space-y-3 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <User className="h-3.5 w-3.5 text-primary" />
                      <span>{t("personalTitle")}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t("dob")}</p>
                        <p className="text-sm font-medium">
                          {dobFormatted || t("notProvided")}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">{t("gender")}</p>
                        <p className="text-sm font-medium capitalize">
                          {displayPatient?.gender
                            ? tGender(displayPatient.gender.toLowerCase())
                            : t("notProvided")}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-xs text-muted-foreground">
                          {t("registered")}
                        </p>
                        <p className="text-sm font-medium">
                          {registeredFormatted || t("notProvided")}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Card */}
                  <div className="space-y-3 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary" />
                      <span>{t("contactTitle")}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {t("phone")}
                          </p>
                          <p
                            dir="ltr"
                            className="truncate text-sm font-medium tabular-nums"
                          >
                            {displayPatient?.phone || t("notProvided")}
                          </p>
                        </div>
                        {displayPatient?.phone && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("copy")}
                            onClick={() =>
                              void handleCopy("phone", displayPatient.phone!)
                            }
                          >
                            {copiedField === "phone" ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground">
                            {t("email")}
                          </p>
                          <p dir="ltr" className="truncate text-sm font-medium">
                            {displayPatient?.email || t("notProvided")}
                          </p>
                        </div>
                        {displayPatient?.email && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={t("copy")}
                            onClick={() =>
                              void handleCopy("email", displayPatient.email!)
                            }
                          >
                            {copiedField === "email" ? (
                              <Check className="h-4 w-4 text-emerald-600" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-md border border-hairline bg-surface px-3 py-2">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">
                          {t("address")}
                        </p>
                        <p className="text-sm font-medium break-words">
                          {displayPatient?.address || t("notProvided")}
                        </p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="visits" className="mt-0 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-primary" />
                    <span>{t("visitsTitle")}</span>
                  </div>

                  {overviewQuery.isLoading ? (
                    <div className="space-y-3">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-16 animate-pulse rounded-lg border border-hairline bg-muted/50"
                        />
                      ))}
                    </div>
                  ) : visits.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-(--radius-card) border border-dashed border-hairline bg-canvas-soft/40 px-4 py-10 text-center">
                      <FileText className="mb-2 h-8 w-8 text-muted-foreground/60" />
                      <p className="text-sm text-muted-foreground">
                        {t("noVisits")}
                      </p>
                    </div>
                  ) : (
                    <div className="relative space-y-4 border-s-2 border-hairline ps-4 ms-2">
                      {visits.map((visit) => (
                        <div
                          key={visit.id}
                          className="relative rounded-lg border border-hairline bg-canvas-soft/60 p-3.5"
                        >
                          <span
                            className={cn(
                              "absolute -start-[23px] top-4 h-3 w-3 rounded-full border-2 border-surface",
                              visit.kind === "encounter"
                                ? "bg-primary"
                                : "bg-sky-500",
                            )}
                          />
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold">
                                {visit.title}
                              </span>
                              <Badge
                                variant={
                                  visit.kind === "encounter" ? "primary" : "info"
                                }
                                className="capitalize"
                              >
                                {visit.badge}
                              </Badge>
                            </div>
                            <span className="flex items-center gap-1 text-xs text-muted-foreground tabular-nums">
                              <Clock className="h-3 w-3" />
                              {safeFormatDate(visit.date, "MMM d, yyyy · HH:mm")}
                            </span>
                          </div>
                          {visit.doctorName && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t("withDoctor", { doctor: visit.doctorName })}
                            </p>
                          )}
                          {visit.detail && (
                            <p className="mt-1.5 text-sm text-foreground/90">
                              {visit.detail}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="account" className="mt-0 space-y-4">
                  {!hasPortal ? (
                    <div className="flex flex-col items-start justify-between gap-4 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-5 sm:flex-row sm:items-center">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-semibold">
                          <Mail className="h-4 w-4 text-primary" />
                          <span>{t("noPortal")}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {t("noPortalDesc")}
                        </p>
                      </div>
                      {displayPatient && (
                        <InviteToPortalButton
                          patient={displayPatient}
                          size="default"
                          variant="default"
                          showActiveLabel={false}
                          onInvited={(info) => {
                            onInvited(info);
                            void queryClient.invalidateQueries({
                              queryKey: ["patient-overview", displayPatient.id],
                            });
                          }}
                        />
                      )}
                    </div>
                  ) : (
                    <>
                      {/* Portal Account Summary */}
                      <div className="grid grid-cols-1 gap-3 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4 sm:grid-cols-3">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            {t("loginEmail")}
                          </p>
                          <p dir="ltr" className="truncate text-sm font-medium">
                            {overviewQuery.data?.portal.email ||
                              displayPatient?.email ||
                              t("notProvided")}
                          </p>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            {t("accountStatus")}
                          </p>
                          <Badge variant="info" className="capitalize">
                            {overviewQuery.data?.portal.status ?? "active"}
                          </Badge>
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted-foreground">
                            {t("lastSignIn")}
                          </p>
                          <p className="text-sm font-medium">
                            {lastSignInFormatted || t("neverSignedIn")}
                          </p>
                        </div>
                      </div>

                      {canManagePasswords ? (
                        <div className="space-y-4">
                          {/* Option 1: Generate Temporary Password */}
                          <div className="flex flex-col justify-between gap-3 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4 sm:flex-row sm:items-center">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <Sparkles className="h-4 w-4 text-primary" />
                                <span>{t("generateTempTitle")}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t("generateTempDesc")}
                              </p>
                            </div>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  type="button"
                                  variant="outline"
                                  disabled={isResetting}
                                  className="shrink-0"
                                >
                                  <RefreshCw
                                    className={cn(
                                      "me-2 h-4 w-4",
                                      isResetting && "animate-spin",
                                    )}
                                  />
                                  {t("generateTempBtn")}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>
                                    {t("generateConfirmTitle")}
                                  </AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {t("generateConfirmDesc", {
                                      name: fullName,
                                    })}
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>
                                    {t("cancel")}
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={handleGenerateTempPassword}
                                  >
                                    {t("generateConfirmAction")}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>

                          {/* Option 2: Set Custom Password */}
                          <form
                            onSubmit={form.handleSubmit(handleSetCustomPassword)}
                            className="space-y-4 rounded-(--radius-card) border border-hairline bg-canvas-soft/60 p-4"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 text-sm font-semibold">
                                <KeyRound className="h-4 w-4 text-primary" />
                                <span>{t("setCustomTitle")}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {t("setCustomDesc")}
                              </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor="patient-new-password">
                                  {t("newPassword")}
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="patient-new-password"
                                    type={showPassword ? "text" : "password"}
                                    dir="ltr"
                                    autoComplete="new-password"
                                    className="pe-10"
                                    placeholder={t("newPasswordPlaceholder")}
                                    {...form.register("password")}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                    onClick={() =>
                                      setShowPassword((prev) => !prev)
                                    }
                                  >
                                    {showPassword ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                {form.formState.errors.password && (
                                  <p className="text-xs text-destructive">
                                    {form.formState.errors.password.message}
                                  </p>
                                )}
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="patient-confirm-password">
                                  {t("confirmPassword")}
                                </Label>
                                <div className="relative">
                                  <Input
                                    id="patient-confirm-password"
                                    type={showConfirm ? "text" : "password"}
                                    dir="ltr"
                                    autoComplete="new-password"
                                    className="pe-10"
                                    placeholder={t("confirmPasswordPlaceholder")}
                                    {...form.register("confirm")}
                                  />
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2"
                                    onClick={() =>
                                      setShowConfirm((prev) => !prev)
                                    }
                                  >
                                    {showConfirm ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </Button>
                                </div>
                                {form.formState.errors.confirm && (
                                  <p className="text-xs text-destructive">
                                    {form.formState.errors.confirm.message}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Password rule pills */}
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5",
                                  passwordChecks.minLength
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-hairline text-muted-foreground",
                                )}
                              >
                                {t("hintMinLength")}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5",
                                  passwordChecks.hasLetter
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-hairline text-muted-foreground",
                                )}
                              >
                                {t("hintLetter")}
                              </span>
                              <span
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5",
                                  passwordChecks.hasNumber
                                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-hairline text-muted-foreground",
                                )}
                              >
                                {t("hintNumber")}
                              </span>
                            </div>

                            <div className="flex justify-end">
                              <Button type="submit" disabled={isSavingPassword}>
                                {isSavingPassword
                                  ? t("savingPassword")
                                  : t("savePassword")}
                              </Button>
                            </div>
                          </form>
                        </div>
                      ) : !canManageQuery.isLoading ? (
                        <div className="flex items-center gap-3 rounded-(--radius-card) border border-hairline bg-muted/40 p-4 text-sm text-muted-foreground">
                          <Lock className="h-4 w-4 shrink-0" />
                          <span>{t("notAllowed")}</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </TabsContent>
              </motion.div>
            </AnimatePresence>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
