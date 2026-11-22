"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getOwnerBranches,
  upsertBranch,
  deleteBranch,
} from "@/app/actions/clinic";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  branchSchema,
  type Branch,
  type OwnerBranchItem,
} from "@/types/clinic.types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Building, Edit2, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
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

interface BranchManagementProps {
  /** Optional externally-fetched branches list to share query data with parent. */
  branches?: OwnerBranchItem[];
  isLoading?: boolean;
}

export function BranchManagement({
  branches: externalBranches,
  isLoading: externalLoading,
}: BranchManagementProps = {}) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.branches");
  const tStatus = useTranslations("enums.status");
  const [isOpen, setIsOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<OwnerBranchItem | null>(
    null,
  );
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const { data: fetchedBranches, isLoading: queryLoading } = useQuery({
    queryKey: ["owner-branches"],
    queryFn: () => getOwnerBranches(),
    enabled: externalBranches === undefined,
  });

  const branches = externalBranches ?? fetchedBranches;
  const isLoading = externalLoading ?? queryLoading;

  const invalidateAllBranchQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["owner-branches"] });
    queryClient.invalidateQueries({ queryKey: ["clinics"] });
    queryClient.invalidateQueries({ queryKey: ["branches"] });
    queryClient.invalidateQueries({ queryKey: ["owner-clinics-branches"] });
  };

  const upsertMutation = useMutation({
    mutationFn: (data: Branch) => upsertBranch(data),
    onSuccess: () => {
      invalidateAllBranchQueries();
      toast.success(editingBranch ? t("toastUpdated") : t("toastCreated"));
      setIsOpen(false);
      setEditingBranch(null);
    },
    onError: (error) => {
      toast.error(error.message || t("toastOperationFailed"));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteBranch(id),
    onSuccess: () => {
      invalidateAllBranchQueries();
      toast.success(t("toastDeleted"));
      setBranchToDelete(null);
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
  } = useForm<Branch>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      status: "active",
    },
  });

  const statusValue = watch("status");

  const onOpenAdd = () => {
    setEditingBranch(null);
    reset({
      id: undefined,
      clinic_id: undefined,
      name: "",
      address: "",
      phone: "",
      status: "active",
    });
    setIsOpen(true);
  };

  const onEdit = (branch: OwnerBranchItem) => {
    setEditingBranch(branch);
    reset({
      id: branch.id,
      name: branch.name,
      address: branch.address ?? "",
      phone: branch.phone ?? "",
      status: branch.status,
    });
    setIsOpen(true);
  };

  const onSubmit = (data: Branch) => {
    upsertMutation.mutate(data);
  };

  if (isLoading) return <div className="py-6 text-sm text-muted-foreground">{t("loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{t("title")}</h2>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={onOpenAdd}>
          <Plus className="me-2 h-4 w-4" />
          {t("addBranch")}
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colName")}</TableHead>
              <TableHead>{t("colAddress")}</TableHead>
              <TableHead>{t("colPhone")}</TableHead>
              <TableHead>{t("colClinics")}</TableHead>
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-end">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches?.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-primary shrink-0" />
                    <span>{branch.name}</span>
                  </div>
                </TableCell>
                <TableCell>{branch.address || "-"}</TableCell>
                <TableCell>{branch.phone || "-"}</TableCell>
                <TableCell>
                  {branch.linked_clinics.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {branch.linked_clinics.map((c) => (
                        <Badge
                          key={c.id}
                          variant="outline"
                          className="text-xs font-normal"
                        >
                          {c.name}
                          {c.is_primary && (
                            <span className="ms-1 text-primary">★</span>
                          )}
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">
                      {t("unassigned")}
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      branch.status === "active" ? "default" : "secondary"
                    }
                  >
                    {branch.status === "active"
                      ? tStatus("active")
                      : tStatus("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end space-x-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(branch)}
                    aria-label={t("editBranch")}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBranchToDelete(branch.id)}
                    aria-label={t("deleteBranch")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {branches?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-8 text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingBranch ? t("editBranch") : t("addBranch")}
            </DialogTitle>
            <DialogDescription>{t("dialogDesc")}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner_branch_name">{t("formName")}</Label>
              <Input
                id="owner_branch_name"
                {...register("name")}
                placeholder={t("formNamePlaceholder")}
              />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_branch_address">{t("formAddress")}</Label>
              <Input id="owner_branch_address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="owner_branch_phone">{t("formPhone")}</Label>
              <Input id="owner_branch_phone" {...register("phone")} />
            </div>
            {editingBranch && (
              <div className="space-y-2">
                <Label>{t("formStatus")}</Label>
                <Select
                  value={statusValue}
                  onValueChange={(val: "active" | "inactive") =>
                    setValue("status", val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{tStatus("active")}</SelectItem>
                    <SelectItem value="inactive">
                      {tStatus("inactive")}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={upsertMutation.isPending}
            >
              {upsertMutation.isPending ? t("saving") : t("saveBranch")}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!branchToDelete}
        onOpenChange={(open) => !open && setBranchToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                branchToDelete && deleteMutation.mutate(branchToDelete)
              }
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t("deleting") : t("deleteBranch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
