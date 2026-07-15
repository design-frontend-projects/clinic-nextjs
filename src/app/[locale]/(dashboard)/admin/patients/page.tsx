"use client";

import { useQuery } from "@tanstack/react-query";
import { getPatients, createPatient } from "@/app/actions/admin";
import { invitePatientToPortal } from "@/app/actions/patient";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { toast } from "sonner";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PatientInsuranceDialog } from "@/components/insurance/patient-insurance-dialog";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Users, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

const patientSchema = z.object({
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
});

type PatientForm = z.infer<typeof patientSchema>;

type Patient = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: Date | null;
  created_at: Date;
  profile_id: string | null;
};

function InviteToPortalCell({ patient, t }: { patient: Patient, t: any }) {
  const [isPending, startTransition] = useTransition();
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);

  if (patient.profile_id) {
    return (
      <span className="text-xs text-muted-foreground">{t("portalActive")}</span>
    );
  }

  const handleInvite = () => {
    if (!patient.email) {
      toast.error(t("noEmail"));
      return;
    }
    startTransition(async () => {
      const result = await invitePatientToPortal(patient.id);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.success && result.tempPassword) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName: `${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim(),
          email: patient.email,
        });
      }
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleInvite}
        disabled={isPending || !patient.email}
      >
        {isPending ? (
          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
        ) : (
          <Mail className="mr-2 h-3.5 w-3.5" />
        )}
        {t("invitePortal")}
      </Button>
      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </>
  );
}

function InsuranceCell({ patient, t }: { patient: Patient, t: any }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <ShieldCheck className="mr-2 h-3.5 w-3.5" />
        {t("insurance")}
      </Button>
      {open && (
        <PatientInsuranceDialog
          patientId={patient.id}
          patientName={`${patient.first_name ?? ""} ${patient.last_name ?? ""}`.trim()}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}

export default function PatientsPage() {
  const t = useTranslations("admin.patients");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const { data: patients = [], refetch } = useQuery({
    queryKey: ["patients"],
    queryFn: () => getPatients(),
  });

  const form = useForm<PatientForm>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      gender: undefined,
      date_of_birth: "",
      address: "",
    },
  });

  const onSubmit = (data: PatientForm) => {
    startTransition(async () => {
      try {
        await createPatient(data);
        toast.success(t("patientAdded"));
        setOpen(false);
        form.reset();
        refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("failedToAdd"),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t("addPatient")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("addNewPatient")}</DialogTitle>
              <DialogDescription>
                {t("registerDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("form.firstName")}</Label>
                  <Input
                    id="first_name"
                    {...form.register("first_name")}
                    placeholder={t("form.firstNamePlaceholder")}
                  />
                  {form.formState.errors.first_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("form.lastName")}</Label>
                  <Input
                    id="last_name"
                    {...form.register("last_name")}
                    placeholder={t("form.lastNamePlaceholder")}
                  />
                  {form.formState.errors.last_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.last_name.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("form.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder={t("form.emailPlaceholder")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("form.phone")}</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    placeholder={t("form.phonePlaceholder")}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("form.gender")}</Label>
                  <Select
                    onValueChange={(v) =>
                      form.setValue("gender", v as "male" | "female" | "other")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("form.genderSelect")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{t("form.male")}</SelectItem>
                      <SelectItem value="female">{t("form.female")}</SelectItem>
                      <SelectItem value="other">{t("form.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">{t("form.dob")}</Label>
                  <Input
                    id="dob"
                    type="date"
                    {...form.register("date_of_birth")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t("form.address")}</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder={t("form.addressPlaceholder")}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t("saving") : t("savePatient")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable
        columns={columns}
        data={patients as Patient[]}
        searchKey="first_name"
        searchPlaceholder={t("searchPatients")}
      />
    </div>
  );
}
