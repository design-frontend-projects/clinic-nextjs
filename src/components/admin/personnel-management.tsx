"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getPersonnel,
  upsertPersonnel,
  deletePersonnel,
} from "@/app/actions/personnel";
import { getActiveSpecialties } from "@/app/actions/specialties";
import { getBranches } from "@/app/actions/clinic";
import { fetchTenantInfoAction } from "@/app/actions/tenant";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSchema,
  INVITABLE_PROFILE_ROLES,
  isBranchLockedRole,
  type Profile,
} from "@/types/clinic.types";
import { useLocale } from "next-intl";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Building2, Edit2, MapPin, Plus, Trash2, User } from "lucide-react";
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

/** "receptionist" -> "Receptionist" for dropdown labels. */
const roleLabel = (r: string) => r.charAt(0).toUpperCase() + r.slice(1);

export function PersonnelManagement({ role, title }: PersonnelManagementProps) {
  const queryClient = useQueryClient();
  const locale = useLocale();
  const [isOpen, setIsOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Profile | null>(
    null,
  );
  const [personnelToDelete, setPersonnelToDelete] = useState<string | null>(
    null,
  );
  const [tempPasswordInfo, setTempPasswordInfo] =
    useState<TempPasswordInfo | null>(null);

  const { data: tenant } = useQuery({
    queryKey: ["tenant-info"],
    queryFn: () => fetchTenantInfoAction(),
  });

  const authUserId = tenant?.auth_user_id as string;

  const { data: personnel, isLoading } = useQuery({
    queryKey: ["personnel", authUserId],
    queryFn: () => getPersonnel(authUserId),
    enabled: !!authUserId,
  });

  const { data: specialties } = useQuery({
    queryKey: ["active-specialties"],
    queryFn: () => getActiveSpecialties(),
    enabled: role === "doctor",
  });

  const clinicId = tenant?.clinicId ?? null;

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
        queryKey: ["personnel", authUserId],
      });
      setIsOpen(false);
      setEditingPersonnel(null);
      if (result && "tempPassword" in result) {
        setTempPasswordInfo({
          tempPassword: result.tempPassword,
          fullName: result.fullName ?? variables.full_name,
          email: variables.email,
        });
      } else {
        toast.success(`${title} updated`);
      }
    },
    onError: (error) => {
      toast.error(error.message || "Operation failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePersonnel(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["personnel", authUserId],
      });
      toast.success(`${title} deleted`);
      setPersonnelToDelete(null);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete");
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
    },
  });

  const onOpenAdd = () => {
    setEditingPersonnel(null);
    reset({
      role,
      status: "active",
      full_name: "",
      email: "",
      phone: "",
      specialty: "",
      // Preselect when the clinic has a single branch.
      branch_id: activeBranches.length === 1 ? activeBranches[0].id : null,
    });
    setIsOpen(true);
  };

  const onEdit = (p: Profile) => {
    setEditingPersonnel(p);
    reset(p);
    setIsOpen(true);
  };

  const onSubmit: SubmitHandler<Profile> = (data) => {
    // Branch is mandatory for new invites of branch-locked roles
    // (also enforced server-side).
    if (
      !editingPersonnel &&
      isBranchLockedRole(data.role) &&
      !data.branch_id
    ) {
      toast.error("Please select a branch");
      return;
    }
    // New invites use the role selected in the form; edits keep the stored
    // role (the dropdown is hidden and the update path never changes it).
    upsertMutation.mutate(data);
  };

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

  if (!authUserId) return <div>Initializing...</div>;
  if (isLoading) return <div>Loading {role}s...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{title}s</h3>
        <Button size="sm" onClick={onOpenAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Invite {title}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Contact</TableHead>
              {role === "doctor" && <TableHead>Specialty</TableHead>}
              <TableHead>Branch</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personnel?.map((p) => (
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
                  <TableCell>{p.specialty || "General"}</TableCell>
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
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(p as Profile)}
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
                </TableCell>
              </TableRow>
            ))}
            {personnel?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={role === "doctor" ? 6 : 5}
                  className="text-center py-8 text-muted-foreground"
                >
                  No {role}s found. Invite one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingPersonnel ? `Edit ${title}` : `Invite ${title}`}
            </DialogTitle>
            <DialogDescription>
              {editingPersonnel
                ? `Update the details for this ${role}.`
                : `Enter details to create a new ${role}. You'll get a temporary password to share with them.`}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input
                  id="full_name"
                  {...register("full_name")}
                  placeholder="e.g. Dr. John Doe"
                />
                {errors.full_name && (
                  <p className="text-xs text-destructive">
                    {errors.full_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email{" "}
                  {!editingPersonnel && (
                    <span className="text-destructive">*</span>
                  )}
                </Label>
                <Input
                  id="email"
                  type="email"
                  {...register("email")}
                  placeholder="doctor@clinic.com"
                  disabled={!!editingPersonnel}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">
                    {errors.email.message}
                  </p>
                )}
                {!editingPersonnel && (
                  <p className="text-xs text-muted-foreground">
                    Used as the sign-in email for the new account.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Clinic</Label>
                <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{tenant?.clinicName ?? "—"}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  New {role}s are created under your clinic.
                </p>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>
                  Branch <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watch("branch_id") ?? ""}
                  onValueChange={(val) =>
                    setValue("branch_id", val, { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Branch" />
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
                  The {role} will be locked to this branch and cannot change
                  it.
                </p>
              </div>
              {role === "doctor" && (
                <div className="space-y-2 col-span-2">
                  <Label>Specialty</Label>
                  <Select
                    value={watch("specialty") ?? ""}
                    onValueChange={(val) => setValue("specialty", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Specialty" />
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
                <Label>Status</Label>
                <Select
                  value={watch("status")}
                  onValueChange={(val) =>
                    setValue("status", val as "active" | "inactive" | "blocked")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {!editingPersonnel && (
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={watch("role") || role}
                    onValueChange={(val) => setValue("role", val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Role" />
                    </SelectTrigger>
                    <SelectContent>
                      {INVITABLE_PROFILE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {roleLabel(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Determines the permissions this {role} will have.
                  </p>
                </div>
              )}
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending
                ? "Processing..."
                : editingPersonnel
                  ? "Save Changes"
                  : `Invite & Create ${title}`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!personnelToDelete}
        onOpenChange={(open) => !open && setPersonnelToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the
              {role} profile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                personnelToDelete && deleteMutation.mutate(personnelToDelete)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete Profile"}
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
