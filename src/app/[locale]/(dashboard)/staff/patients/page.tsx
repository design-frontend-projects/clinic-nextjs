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
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Users, Mail, Loader2 } from "lucide-react";
import { useState, useTransition, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

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

function InviteToPortalCell({ patient }: { patient: Patient }) {
  const t = useTranslations("pages.staff.patients");
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
      toast.error(t("toastNoEmail"));
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
        {t("inviteToPortal")}
      </Button>
      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </>
  );
}

export default function PatientsPage() {
  const t = useTranslations("pages.staff.patients");
  const tGender = useTranslations("enums.gender");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const patientSchema = useMemo(() => z.object({
    first_name: z.string().min(1, t("errFirstNameRequired")),
    last_name: z.string().min(1, t("errLastNameRequired")),
    email: z.string().email(t("errEmailInvalid")).optional().or(z.literal("")),
    phone: z.string().optional(),
    gender: z.enum(["male", "female", "other"]).optional(),
    date_of_birth: z.string().optional(),
    address: z.string().optional(),
  }), [t]);

  type PatientForm = z.infer<typeof patientSchema>;

  const columns = useMemo<ColumnDef<Patient>[]>(
    () => [
      {
        accessorKey: "first_name",
        header: t("colName"),
        cell: ({ row }) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">
                {row.original.first_name} {row.original.last_name}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.original.email || t("noEmail")}
              </p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: "phone",
        header: t("colPhone"),
        cell: ({ row }) => row.original.phone || "—",
      },
      {
        accessorKey: "gender",
        header: t("colGender"),
        cell: ({ row }) => (
          <span className="capitalize">
            {row.original.gender ? tGender(row.original.gender.toLowerCase()) : "—"}
          </span>
        ),
      },
      {
        accessorKey: "date_of_birth",
        header: t("colDob"),
        cell: ({ row }) =>
          row.original.date_of_birth
            ? format(new Date(row.original.date_of_birth), "MMM d, yyyy")
            : "—",
      },
      {
        accessorKey: "created_at",
        header: t("colRegistered"),
        cell: ({ row }) => format(new Date(row.original.created_at), "MMM d, yyyy"),
      },
      {
        id: "portal",
        header: t("colPortal"),
        cell: ({ row }) => <InviteToPortalCell patient={row.original} />,
      },
    ],
    [t, tGender],
  );

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
        toast.success(t("toastPatientAdded"));
        setOpen(false);
        form.reset();
        refetch();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("toastPatientFailed"),
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
              {t("btnAddPatient")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{t("dialogTitle")}</DialogTitle>
              <DialogDescription>
                {t("dialogDesc")}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{t("lblFirstName")} *</Label>
                  <Input
                    id="first_name"
                    {...form.register("first_name")}
                    placeholder="John"
                  />
                  {form.formState.errors.first_name && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.first_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{t("lblLastName")} *</Label>
                  <Input
                    id="last_name"
                    {...form.register("last_name")}
                    placeholder="Doe"
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
                  <Label htmlFor="email">{t("lblEmail")}</Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("lblPhone")}</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("lblGender")}</Label>
                  <Select
                    onValueChange={(v) =>
                      form.setValue("gender", v as "male" | "female" | "other")
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("genderPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">{tGender("male")}</SelectItem>
                      <SelectItem value="female">{tGender("female")}</SelectItem>
                      <SelectItem value="other">{tGender("other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dob">{t("lblDob")}</Label>
                  <Input
                    id="dob"
                    type="date"
                    {...form.register("date_of_birth")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">{t("lblAddress")}</Label>
                <Input
                  id="address"
                  {...form.register("address")}
                  placeholder="123 Main St..."
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                >
                  {t("btnCancel")}
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? t("btnSaving") : t("btnSavePatient")}
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
        searchPlaceholder={t("searchPlaceholder")}
      />
    </div>
  );
}
