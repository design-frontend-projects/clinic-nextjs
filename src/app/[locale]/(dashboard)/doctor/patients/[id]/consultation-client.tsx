"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { Activity, Pill, History, Calendar, CheckCircle2, ChevronRight, FileText, ClipboardList, ShieldCheck } from "lucide-react";
import { PatientInsurancePanel } from "@/components/insurance/patient-insurance-panel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EncounterForm } from "./encounter-form";
import { PatientPrescriptions, type PatientPrescription } from "./patient-prescriptions";
import { StatusBadge } from "@/components/ui/status-badge";
import { useTranslations } from "next-intl";

interface Patient {
  id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  date_of_birth: Date | string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface Encounter {
  id: string;
  encounter_date: Date | string;
  diagnosis: string | null;
  notes: string | null;
  profiles: { full_name: string | null } | null;
}

interface LabOrder {
  id: string;
  created_at: Date | string;
  status: string;
  test_name: string | null;
}

interface ConsultationClientProps {
  patient: Patient;
  history: Encounter[];
  prescriptions: PatientPrescription[];
  labOrders: LabOrder[];
  appointmentId?: string;
}

function calculateAge(dob: Date | string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100 } },
} as const;


export function ConsultationClient({
  patient,
  history,
  prescriptions,
  labOrders,
  appointmentId,
}: ConsultationClientProps) {
  const t = useTranslations("pages.doctor.consultation");
  const tGender = useTranslations("enums.gender");
  
  const patientInitials = `${patient.first_name?.charAt(0) ?? ""}${patient.last_name?.charAt(0) ?? ""}`.toUpperCase();
  const ageVal = calculateAge(patient.date_of_birth);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Patient Hero Card (Glassmorphic & Animated) */}
      <motion.div
        variants={itemVariants}
        className="rounded-2xl border border-border/40 bg-card/60 p-6 backdrop-blur-md shadow-sm relative overflow-hidden"
      >
        <div className="absolute right-0 top-0 h-40 w-40 bg-accent-blue-soft rounded-full filter blur-3xl opacity-35 -mr-16 -mt-16" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-blue-soft text-accent-blue font-extrabold text-xl">
              {patientInitials || "PT"}
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                {patient.first_name} {patient.last_name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-1.5 text-sm text-muted-foreground font-medium">
                <span className="capitalize px-2.5 py-0.5 rounded-lg bg-muted text-foreground border border-border/20 text-xs font-semibold">
                  {patient.gender ? tGender(patient.gender.toLowerCase()) : tGender("unknown")}
                </span>
                <span>•</span>
                <span>DOB: {patient.date_of_birth ? format(new Date(patient.date_of_birth), "MMM d, yyyy") : "N/A"}</span>
                <span>•</span>
                <span>{ageVal !== null ? t("yearsOld", { age: ageVal }) : "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 border-t border-border/30 pt-4 md:border-t-0 md:pt-0">
            <div className="text-center px-4 py-1 border-r border-border/30">
              <p className="text-xs text-muted-foreground font-semibold">{t("metricVisits")}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{history.length}</p>
            </div>
            <div className="text-center px-4 py-1 border-r border-border/30">
              <p className="text-xs text-muted-foreground font-semibold">{t("metricPrescriptions")}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{prescriptions.length}</p>
            </div>
            <div className="text-center px-4 py-1">
              <p className="text-xs text-muted-foreground font-semibold">{t("metricLabs")}</p>
              <p className="text-lg font-bold text-foreground mt-0.5">{labOrders.length}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Grid: Form and Patient File History */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: New Encounter Notes */}
        <motion.div variants={itemVariants} className="md:col-span-2 space-y-6">
          <Card className="border border-border/40 bg-card/65 backdrop-blur-md shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-accent-blue" />
                {t("newEncounterTitle")}
              </CardTitle>
              <CardDescription>
                {t("newEncounterDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EncounterForm
                patientId={patient.id}
                appointmentId={appointmentId}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Right Column: History & Context (Tabs) */}
        <motion.div variants={itemVariants} className="space-y-6">
          <Tabs defaultValue="history">
            <TabsList className="grid w-full grid-cols-4 rounded-xl bg-muted/60 p-1 border border-border/30">
              <TabsTrigger value="history" className="rounded-lg text-xs font-semibold py-2">{t("tabHistory")}</TabsTrigger>
              <TabsTrigger value="meds" className="rounded-lg text-xs font-semibold py-2">{t("tabMeds")}</TabsTrigger>
              <TabsTrigger value="labs" className="rounded-lg text-xs font-semibold py-2">{t("tabLabs")}</TabsTrigger>
              <TabsTrigger value="insurance" className="rounded-lg text-xs font-semibold py-2">{t("tabInsurance")}</TabsTrigger>
            </TabsList>

            {/* Past Encounters Tab */}
            <TabsContent value="history" className="mt-4">
              <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-sm max-h-[500px] overflow-y-auto">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <History className="h-4.5 w-4.5 text-accent-blue" />
                  <CardTitle className="text-sm font-bold">{t("pastEncounters")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {history.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t("noPastEncounters")}
                    </p>
                  ) : (
                    history.slice(0, 10).map((enc) => (
                      <div
                        key={enc.id}
                        className="border-b border-border/20 last:border-0 pb-3 last:pb-0 text-sm group"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-accent-blue">
                            {format(new Date(enc.encounter_date), "MMM d, yyyy")}
                          </p>
                          <p className="text-[10px] font-medium text-muted-foreground">
                            {t("byPractitioner", { name: enc.profiles?.full_name || "Practitioner" })}
                          </p>
                        </div>
                        <p className="font-semibold text-foreground mt-1 text-xs">
                          {t("diagnosisLabel")} <span className="font-normal text-muted-foreground">{enc.diagnosis || "N/A"}</span>
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs leading-relaxed line-clamp-3 group-hover:line-clamp-none transition-all">
                          {enc.notes}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Prescriptions Tab */}
            <TabsContent value="meds" className="mt-4">
              <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-sm">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <Pill className="h-4.5 w-4.5 text-accent-green" />
                  <CardTitle className="text-sm font-bold">{t("activePrescriptions")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PatientPrescriptions
                    patientId={patient.id}
                    prescriptions={prescriptions as PatientPrescription[]}
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* Recent Labs Tab */}
            <TabsContent value="labs" className="mt-4">
              <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-sm max-h-[500px] overflow-y-auto">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <ClipboardList className="h-4.5 w-4.5 text-accent-yellow" />
                  <CardTitle className="text-sm font-bold">{t("recentLabs")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {labOrders.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {t("noLabs")}
                    </p>
                  ) : (
                    labOrders.slice(0, 10).map((lab) => (
                      <div
                        key={lab.id}
                        className="border-b border-border/20 last:border-0 pb-3 last:pb-0 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground text-xs">
                            {lab.test_name || t("routineLab")}
                          </p>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(lab.created_at), "MMM d, yyyy")}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <StatusBadge status={lab.status} />
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insurance Tab */}
            <TabsContent value="insurance" className="mt-4">
              <Card className="border border-border/40 bg-card/60 backdrop-blur-md shadow-sm max-h-[500px] overflow-y-auto">
                <CardHeader className="pb-3 flex flex-row items-center gap-2">
                  <ShieldCheck className="h-4.5 w-4.5 text-emerald-600" />
                  <CardTitle className="text-sm font-bold">{t("insuranceTitle")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <PatientInsurancePanel
                    patientId={patient.id}
                    patientName={`${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim()}
                    emptyLabel={t("noInsurance")}
                    manageLabel={t("manageInsurance")}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </motion.div>
  );
}
