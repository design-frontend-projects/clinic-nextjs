"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPersonnel,
  upsertPersonnel,
  updateOwnerDoctorAvailability,
  deletePersonnel,
} from "@/app/actions/personnel";
import { getActiveSpecialties } from "@/app/actions/specialties";
import {
  getBranches,
  getOwnerClinics,
  getOwnerClinicsWithBranches,
} from "@/app/actions/clinic";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
import { DoctorAssignmentEditor } from "@/components/admin/doctor-assignment-editor";
import {
  TempPasswordDialog,
  type TempPasswordInfo,
} from "@/components/admin/temp-password-dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  doctorAvailabilitySchema,
  INVITABLE_PROFILE_ROLES,
  SLOT_DURATION_OPTIONS,
  WEEKDAY_INDICES,
  isBranchLockedRole,
  isMultiBranchRole,
  type Profile,
  type DoctorAvailabilityInput,
  type DoctorBranchAssignment,
} from "@/types/clinic.types";
import {
  normalizeDoctorAvailability,
  parseTimeToMinutes,
} from "@/lib/booking-rules";
import { cn } from "@/lib/utils";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  CalendarClock,
  Clock,
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  User,
} from "lucide-react";
import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PersonnelManagementProps {
  role: "doctor" | "staff";
  title: string;
}

/** A personnel row as returned by `getPersonnel` (includes branch + assignments). */
type PersonnelRow = Awaited<ReturnType<typeof getPersonnel>>[number];

/** "receptionist" -> "Receptionist" for dropdown labels. */
const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

export function PersonnelManagement({ role, title }: PersonnelManagementProps) {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const t = useTranslations("admin.personnel");
  const tStatus = useTranslations("enums.status");
  const tRoles = useTranslations("notifications.roles");
  const tDaysShort = useTranslations("common.daysShort");
  const [isOpen, setIsOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Profile | null>(
    null,
  );
  const [personnelToDelete, setPersonnelToDelete] = useState<string | null>(
    null,
  );
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);
  const [isOwnerScheduleOpen, setIsOwnerScheduleOpen] = useState(false);
  // Clinic selection is informational only: personnel are always created under
  // the caller's default clinic (server-derived), and branches are always
  // listed from that default clinic. `null` falls back to the default clinic.
  const [selectedClinicId, setSelectedClinicId] = useState<string | null>(null);
  // Doctor multi-clinic/branch assignment editor state (used when the form role
  // is a multi-branch role). `primaryBranchId` is the home/default branch.
  const [assignments, setAssignments] = useState<DoctorBranchAssignment[]>([]);
  const [primaryBranchId, setPrimaryBranchId] = useState<string | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const authUserId = tenant?.auth_user_id as string;

  const { data: personnel, isLoading } = useQuery({
    queryKey: ["personnel", role],
    queryFn: () => getPersonnel(role),
    enabled: !!authUserId,
  });

  const { data: specialties } = useQuery({
    queryKey: ["active-specialties"],
    queryFn: () => getActiveSpecialties(),
    enabled: role === "doctor",
  });

  const clinicId = tenant?.clinicId ?? null;

  // All clinics owned by this clinic's owner, for the (informational) clinic
  // dropdown. Default (`is_primary`) clinic is ordered first server-side.
  const { data: ownerClinics } = useQuery({
    queryKey: ["owner-clinics", clinicId],
    queryFn: () => getOwnerClinics(),
    enabled: !!clinicId,
  });

  // All of the owner's clinics with their active branches, for the doctor
  // multi-clinic/branch assignment editor.
  const { data: ownerClinicsWithBranches } = useQuery({
    queryKey: ["owner-clinics-branches", clinicId],
    queryFn: () => getOwnerClinicsWithBranches(),
    // Fetch whenever a clinic exists: the invite Role dropdown can select
    // "doctor" even on the staff page, which needs this data.
    enabled: !!clinicId,
  });

  // The clinic shown/selected in the dropdown; defaults to the caller's default
  // clinic. Does not affect submission or the branch list.
  const displayClinicId = selectedClinicId ?? clinicId;

  // Branches are always listed from the default clinic only, regardless of the
  // clinic dropdown selection.
  const { data: branches } = useQuery({
    queryKey: ["clinic-branches", clinicId],
    queryFn: () => getBranches(clinicId!),
    enabled: !!clinicId,
  });

  const activeBranches = (branches ?? []).filter((b) => b.status === "active");

  const upsertMutation = useMutation({
    mutationFn: (data: Profile) => upsertPersonnel(data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["personnel", role],
      });
      queryClient.invalidateQueries({
        queryKey: ["booking-context"],
      });
      setIsOpen(false);
      setEditingPersonnel(null);
      if (result && "tempPassword" in result) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName: result.fullName ?? variables.full_name,
          email: variables.email,
          phone: variables.phone,
        });
      } else {
        toast.success(t("toastUpdated", { title }));
      }
    },
    onError: (error) => {
      toast.error(error.message || t("toastOperationFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePersonnel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personnel", role],
      });
      toast.success(t("toastDeleted", { title }));
      setPersonnelToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || t("toastDeleteFailed"));
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<Profile>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      role: role,
      status: "active",
      available_from: "09:00",
      available_to: "17:00",
      slot_duration_minutes: 30,
      available_days: [0, 1, 2, 3, 4],
    },
  });

  const ownerScheduleForm = useForm<DoctorAvailabilityInput>({
    resolver: zodResolver(doctorAvailabilitySchema),
    defaultValues: {
      available_from: "09:00",
      available_to: "17:00",
      slot_duration_minutes: 30,
      available_days: [0, 1, 2, 3, 4],
    },
  });

  const ownerScheduleMutation = useMutation({
    mutationFn: (data: DoctorAvailabilityInput) =>
      updateOwnerDoctorAvailability(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personnel", role] });
      queryClient.invalidateQueries({ queryKey: ["booking-context"] });
      setIsOwnerScheduleOpen(false);
      toast.success(t("toastScheduleUpdated"));
    },
    onError: (error) => {
      toast.error(error.message || t("toastOperationFailed"));
    },
  });

  const onOpenAdd = () => {
    setEditingPersonnel(null);
    setAssignments([]);
    setPrimaryBranchId(null);
    reset({
      role,
      status: "active",
      full_name: "",
      email: "",
      phone: "",
      specialty: "",
      // Preselect when the clinic has a single branch.
      branch_id: activeBranches.length === 1 ? activeBranches[0].id : null,
      available_from: "09:00",
      available_to: "17:00",
      slot_duration_minutes: 30,
      available_days: [0, 1, 2, 3, 4],
    });
    setIsOpen(true);
  };

  const onEdit = (p: PersonnelRow) => {
    setEditingPersonnel(p as Profile);
    // Preload the doctor's existing (clinic, branch) assignments.
    const rows = p.profile_branches ?? [];
    setAssignments(
      rows.map((r) => ({ clinic_id: r.clinic_id, branch_id: r.branch_id })),
    );
    setPrimaryBranchId(
      rows.find((r) => r.is_primary)?.branch_id ?? rows[0]?.branch_id ?? null,
    );
    const normalized = normalizeDoctorAvailability(p);
    reset({
      ...(p as Profile),
      available_from: normalized.availableFrom,
      available_to: normalized.availableTo,
      slot_duration_minutes: normalized.slotDurationMinutes,
      available_days: normalized.availableDays,
    });
    setIsOpen(true);
  };

  const onOpenOwnerSchedule = (p: PersonnelRow) => {
    const normalized = normalizeDoctorAvailability(p);
    ownerScheduleForm.reset({
      available_from: normalized.availableFrom,
      available_to: normalized.availableTo,
      slot_duration_minutes: normalized.slotDurationMinutes,
      available_days: normalized.availableDays,
    });
    setIsOwnerScheduleOpen(true);
  };

  const onSubmit: SubmitHandler<Profile> = (data) => {
    // Multi-branch roles (doctor): submit the (clinic, branch) assignment set.
    if (isMultiBranchRole(data.role)) {
      if (assignments.length === 0) {
        toast.error(t("toastSelectClinicBranch"));
        return;
      }
      upsertMutation.mutate({
        ...data,
        assignments,
        primary_branch_id: primaryBranchId,
        branch_id: primaryBranchId,
      });
      return;
    }
    // Branch is mandatory for new invites of branch-locked roles
    // (also enforced server-side).
    if (
      !editingPersonnel &&
      isBranchLockedRole(data.role) &&
      !data.branch_id
    ) {
      toast.error(t("toastSelectBranch"));
      return;
    }
    // New invites use the role selected in the form; edits keep the stored
    // role (the dropdown is hidden and the update path never changes it).
    upsertMutation.mutate(data);
  };

  // The role currently selected in the form (may differ from the page's default
  // role on new invites, where the Role dropdown is shown). Multi-branch roles
  // get the clinic/branch assignment editor instead of single selects.
  const formRole = watch("role");
  const isDoctorForm = isMultiBranchRole(formRole);

  const currentBranchId = watch("branch_id");
  // Include the assigned branch even if it's now inactive, so editing an
  // unrelated field doesn't blank the select or resubmit a hidden value.
  const branchOptions =
    currentBranchId &&
    !activeBranches.some((b) => b.id === currentBranchId) &&
    (branches ?? []).some((b) => b.id === currentBranchId)
      ? [
          ...activeBranches,
          (branches ?? []).find((b) => b.id === currentBranchId)!,
        ]
      : activeBranches;

  // Catalog specialties, plus the stored value when it isn't in the active
  // catalog (legacy free-text entries) so the select isn't blank on edit.
  const currentSpecialty = watch("specialty");
  const specialtyOptions =
    currentSpecialty &&
    !(specialties ?? []).some((s) => s.name === currentSpecialty)
      ? [
          ...(specialties ?? []),
          { id: currentSpecialty, name: currentSpecialty, name_ar: null },
        ]
      : (specialties ?? []);

  const currentAvailableFrom = watch("available_from") ?? "09:00";
  const currentAvailableTo = watch("available_to") ?? "17:00";
  const currentSlotDuration = watch("slot_duration_minutes") ?? 30;
  const currentAvailableDays = watch("available_days") ?? [0, 1, 2, 3, 4];

  const computeDailySlotPreview = (
    from: string,
    to: string,
    duration: number,
  ) => {
    const startMin = parseTimeToMinutes(from);
    const endMin = parseTimeToMinutes(to);
    if (startMin === null || endMin === null || endMin <= startMin) return 0;
    return Math.floor((endMin - startMin) / duration);
  };

  const formDailySlotCount = computeDailySlotPreview(
    currentAvailableFrom,
    currentAvailableTo,
    currentSlotDuration,
  );

  const ownerFrom = ownerScheduleForm.watch("available_from");
  const ownerTo = ownerScheduleForm.watch("available_to");
  const ownerDuration = ownerScheduleForm.watch("slot_duration_minutes");
  const ownerDays = ownerScheduleForm.watch("available_days");
  const ownerDailySlotCount = computeDailySlotPreview(
    ownerFrom,
    ownerTo,
    ownerDuration,
  );

  const toggleDayInList = (
    current: number[],
    day: number,
    onUpdate: (next: number[]) => void,
  ) => {
    const exists = current.includes(day);
    const next = exists
      ? current.filter((d) => d !== day)
      : [...current, day].sort((a, b) => a - b);
    onUpdate(next);
  };

  if (!authUserId) return <div>{t("initializing")}</div>;
  if (isLoading) return <div>{t("loading", { role: role === "doctor" ? t("doctorsPlural") : t("staffPlural") })}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{role === "doctor" ? t("doctorsPlural") : t("staffPlural")}</h3>
        <Button size="sm" onClick={onOpenAdd}>
          <Plus className="me-2 h-4 w-4" />
          {t("inviteButton", { title })}
        </Button>
      </div>

      <div className="border rounded-md overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colContact")}</TableHead>
              {role === "doctor" && <TableHead>{t("colSpecialty")}</TableHead>}
              {role === "doctor" && <TableHead>{t("colAvailability")}</TableHead>}
              <TableHead>{t("colBranch")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-end">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel?.map((p) => {
              const docAvailability = normalizeDoctorAvailability(p);
              return (
              <TableRow key={p.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {p.full_name}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col text-xs text-muted-foreground">
                    <span>{p.email || "-"}</span>
                    <span>{p.phone || "-"}</span>
                  </div>
                </TableCell>
                {role === "doctor" && (
                  <TableCell>{p.specialty || t("generalSpecialty")}</TableCell>
                )}
                {role === "doctor" && (
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs font-medium tabular-nums">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span>
                          {docAvailability.availableFrom} – {docAvailability.availableTo}
                        </span>
                        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                          {t("durationMinutes", {
                            minutes: docAvailability.slotDurationMinutes,
                          })}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {docAvailability.availableDays.map((day) => (
                          <span
                            key={day}
                            className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                          >
                            {tDaysShort(String(day))}
                          </span>
                        ))}
                      </div>
                    </div>
                  </TableCell>
                )}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {p.branches?.name ?? "—"}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={p.status === "active" ? "default" : "secondary"}
                  >
                    {p.status === "active"
                      ? tStatus("active")
                      : p.status === "blocked"
                        ? tStatus("blocked")
                        : tStatus("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end">
                  <div className="inline-flex items-center justify-end gap-1.5">
                    {p.role === "owner" ? (
                      <>
                        {p.id === tenant?.profileId && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => onOpenOwnerSchedule(p)}
                          >
                            <CalendarClock className="me-1 h-3.5 w-3.5" />
                            {t("ownerScheduleBtn")}
                          </Button>
                        )}
                        <Badge variant="secondary">{t("ownerBadge")}</Badge>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(p)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setPersonnelToDelete(p.id!)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
            {personnel?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={role === "doctor" ? 7 : 5}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("empty", { role: role === "doctor" ? t("doctorsPlural") : t("staffPlural") })}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[calc(100%-1.5rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b border-hairline px-5 py-4 sm:px-6">
            <DialogTitle>
              {editingPersonnel ? t("editTitle", { title }) : t("inviteTitle", { title })}
            </DialogTitle>
            <DialogDescription>
              {editingPersonnel
                ? t("editDesc", { title })
                : t("inviteDesc", { title })}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4 sm:px-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="full_name">{t("formFullName")}</Label>
                  <Input
                    id="full_name"
                    {...register("full_name")}
                    placeholder={t("formFullNamePlaceholder")}
                  />
                  {errors.full_name && (
                    <p className="text-xs text-destructive">
                      {errors.full_name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">
                    {t("formEmail")}{" "}
                    {!editingPersonnel && (
                      <span className="text-destructive">*</span>
                    )}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    {...register("email")}
                    placeholder={t("formEmailPlaceholder")}
                    disabled={!!editingPersonnel}
                  />
                  {errors.email && (
                    <p className="text-xs text-destructive">
                      {errors.email.message}
                    </p>
                  )}
                  {!editingPersonnel && (
                    <p className="text-xs text-muted-foreground">
                      {t("formEmailHint")}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">{t("formPhone")}</Label>
                  <Input id="phone" dir="ltr" {...register("phone")} />
                </div>
                {isDoctorForm ? (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>
                      {t("formClinicsBranches")}{" "}
                      <span className="text-destructive">*</span>
                    </Label>
                    <DoctorAssignmentEditor
                      clinics={ownerClinicsWithBranches ?? []}
                      assignments={assignments}
                      primaryBranchId={primaryBranchId}
                      onChange={(a, p) => {
                        setAssignments(a);
                        setPrimaryBranchId(p);
                      }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>{t("formClinic")}</Label>
                      <Select
                        value={displayClinicId ?? ""}
                        onValueChange={(val) => setSelectedClinicId(val)}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("formSelectClinic")} />
                        </SelectTrigger>
                        <SelectContent>
                          {(ownerClinics ?? []).map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              <span className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                {c.name}
                                {c.is_primary && (
                                  <span className="text-xs text-muted-foreground">
                                    ({t("defaultLabel")})
                                  </span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {t("formClinicHint")}
                      </p>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>
                        {t("formBranch")} <span className="text-destructive">*</span>
                      </Label>
                      <Select
                        value={watch("branch_id") ?? ""}
                        onValueChange={(val) =>
                          setValue("branch_id", val, { shouldValidate: true })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder={t("formSelectBranch")} />
                        </SelectTrigger>
                        <SelectContent>
                          {branchOptions.map((b) => (
                            <SelectItem key={b.id} value={b.id!}>
                              <span className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-muted-foreground" />
                                {b.name}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.branch_id && (
                        <p className="text-xs text-destructive">
                          {errors.branch_id.message}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {t("formBranchLockedHint")}
                      </p>
                    </div>
                  </>
                )}
                {(role === "doctor" || isDoctorForm) && (
                  <div className="space-y-2 sm:col-span-2">
                    <Label>{t("formSpecialty")}</Label>
                    <Select
                      value={watch("specialty") ?? ""}
                      onValueChange={(val) => setValue("specialty", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("formSelectSpecialty")} />
                      </SelectTrigger>
                      <SelectContent>
                        {specialtyOptions.map((s) => (
                          <SelectItem key={s.name} value={s.name}>
                            {locale === "ar" && s.name_ar ? s.name_ar : s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label>{t("formStatus")}</Label>
                  <Select
                    value={watch("status")}
                    onValueChange={(val) =>
                      setValue("status", val as "active" | "inactive" | "blocked")
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("formSelectStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">{tStatus("active")}</SelectItem>
                      <SelectItem value="inactive">{tStatus("inactive")}</SelectItem>
                      <SelectItem value="blocked">{tStatus("blocked")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingPersonnel && (
                  <div className="space-y-2">
                    <Label>{t("formRole")}</Label>
                    <Select
                      value={watch("role") || role}
                      onValueChange={(val) => setValue("role", val)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={t("formSelectRole")} />
                      </SelectTrigger>
                      <SelectContent>
                        {INVITABLE_PROFILE_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {tRoles.has(r) ? tRoles(r) : roleLabel(r)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {t("formRoleHint")}
                    </p>
                  </div>
                )}
              </div>

              {isDoctorForm && (
                <div className="space-y-4 rounded-[var(--radius-card)] border border-hairline bg-canvas-soft/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 text-primary" />
                        <span>{t("availabilitySectionTitle")}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("availabilitySectionDesc")}
                      </p>
                    </div>
                    {formDailySlotCount > 0 && (
                      <Badge variant="outline" className="tabular-nums text-xs">
                        {t("slotsPerDayPreview", { count: formDailySlotCount })}
                      </Badge>
                    )}
                  </div>

                  {/* Working Days */}
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <Label>{t("workingDaysLabel")}</Label>
                      <div className="flex flex-wrap gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() =>
                            setValue("available_days", [0, 1, 2, 3, 4], {
                              shouldValidate: true,
                            })
                          }
                        >
                          {t("presetSunThu")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() =>
                            setValue("available_days", [1, 2, 3, 4, 5], {
                              shouldValidate: true,
                            })
                          }
                        >
                          {t("presetMonFri")}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[11px]"
                          onClick={() =>
                            setValue("available_days", [0, 1, 2, 3, 4, 5, 6], {
                              shouldValidate: true,
                            })
                          }
                        >
                          {t("presetEveryDay")}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {WEEKDAY_INDICES.map((day) => {
                        const selected = currentAvailableDays.includes(day);
                        return (
                          <Button
                            key={day}
                            type="button"
                            size="sm"
                            variant={selected ? "default" : "outline"}
                            onClick={() =>
                              toggleDayInList(
                                currentAvailableDays,
                                day,
                                (next) =>
                                  setValue("available_days", next, {
                                    shouldValidate: true,
                                  }),
                              )
                            }
                            className={cn(
                              "h-8 min-w-[44px] px-2.5 text-xs",
                              !selected && "bg-surface",
                            )}
                          >
                            {tDaysShort(String(day))}
                          </Button>
                        );
                      })}
                    </div>
                    {errors.available_days && (
                      <p className="text-xs text-destructive">
                        {t("errSelectWorkingDay")}
                      </p>
                    )}
                  </div>

                  {/* Available From / To */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="available_from">
                        {t("availableFromLabel")}
                      </Label>
                      <Input
                        id="available_from"
                        type="time"
                        dir="ltr"
                        className="bg-surface tabular-nums"
                        {...register("available_from")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="available_to">
                        {t("availableToLabel")}
                      </Label>
                      <Input
                        id="available_to"
                        type="time"
                        dir="ltr"
                        className="bg-surface tabular-nums"
                        {...register("available_to")}
                      />
                      {errors.available_to && (
                        <p className="text-xs text-destructive">
                          {t("errEndAfterStart")}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Slot Duration */}
                  <div className="space-y-2">
                    <Label>{t("slotDurationLabel")}</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {SLOT_DURATION_OPTIONS.map((minutes) => {
                        const selected = currentSlotDuration === minutes;
                        return (
                          <Button
                            key={minutes}
                            type="button"
                            variant={selected ? "default" : "outline"}
                            className={cn(
                              "h-9 justify-center text-xs font-medium",
                              !selected && "bg-surface",
                            )}
                            onClick={() =>
                              setValue("slot_duration_minutes", minutes, {
                                shouldValidate: true,
                              })
                            }
                          >
                            <Clock className="me-1.5 h-3.5 w-3.5" />
                            {t("durationMinutes", { minutes })}
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="border-t border-hairline bg-surface px-5 py-3.5 sm:px-6">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => setIsOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
                disabled={upsertMutation.isPending}
              >
                {upsertMutation.isPending
                  ? t("processing")
                  : editingPersonnel
                    ? t("saveChanges")
                    : t("inviteAndCreate", { title })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Owner Doctor Schedule Dialog */}
      <Dialog open={isOwnerScheduleOpen} onOpenChange={setIsOwnerScheduleOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("ownerScheduleTitle")}</DialogTitle>
            <DialogDescription>{t("ownerScheduleDesc")}</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={ownerScheduleForm.handleSubmit((data) =>
              ownerScheduleMutation.mutate(data),
            )}
            className="space-y-4"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>{t("workingDaysLabel")}</Label>
                {ownerDailySlotCount > 0 && (
                  <Badge variant="outline" className="tabular-nums text-xs">
                    {t("slotsPerDayPreview", { count: ownerDailySlotCount })}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAY_INDICES.map((day) => {
                  const selected = ownerDays.includes(day);
                  return (
                    <Button
                      key={day}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      onClick={() =>
                        toggleDayInList(ownerDays, day, (next) =>
                          ownerScheduleForm.setValue("available_days", next, {
                            shouldValidate: true,
                          }),
                        )
                      }
                      className="h-8 min-w-[42px] px-2 text-xs"
                    >
                      {tDaysShort(String(day))}
                    </Button>
                  );
                })}
              </div>
              {ownerScheduleForm.formState.errors.available_days && (
                <p className="text-xs text-destructive">
                  {t("errSelectWorkingDay")}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="owner_available_from">
                  {t("availableFromLabel")}
                </Label>
                <Input
                  id="owner_available_from"
                  type="time"
                  dir="ltr"
                  className="tabular-nums"
                  {...ownerScheduleForm.register("available_from")}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="owner_available_to">
                  {t("availableToLabel")}
                </Label>
                <Input
                  id="owner_available_to"
                  type="time"
                  dir="ltr"
                  className="tabular-nums"
                  {...ownerScheduleForm.register("available_to")}
                />
                {ownerScheduleForm.formState.errors.available_to && (
                  <p className="text-xs text-destructive">
                    {t("errEndAfterStart")}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("slotDurationLabel")}</Label>
              <div className="grid grid-cols-2 gap-2">
                {SLOT_DURATION_OPTIONS.map((minutes) => {
                  const selected = ownerDuration === minutes;
                  return (
                    <Button
                      key={minutes}
                      type="button"
                      variant={selected ? "default" : "outline"}
                      className="h-9 justify-center text-xs font-medium"
                      onClick={() =>
                        ownerScheduleForm.setValue(
                          "slot_duration_minutes",
                          minutes,
                          { shouldValidate: true },
                        )
                      }
                    >
                      <Clock className="me-1.5 h-3.5 w-3.5" />
                      {t("durationMinutes", { minutes })}
                    </Button>
                  );
                })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOwnerScheduleOpen(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                disabled={ownerScheduleMutation.isPending}
              >
                {ownerScheduleMutation.isPending && (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                )}
                {t("saveChanges")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!personnelToDelete}
        onOpenChange={(open) => !open && setPersonnelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                personnelToDelete && deleteMutation.mutate(personnelToDelete)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("deleting") : t("deleteProfile")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TempPasswordDialog
        info={tempPasswordInfo}
        onClose={() => setTempPasswordInfo(null)}
      />
    </div>
  );
}
