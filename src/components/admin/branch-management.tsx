"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getBranches, upsertBranch, deleteBranch } from "@/app/actions/clinic";
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
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { branchSchema, type Branch } from "@/types/clinic.types";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Edit2, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
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
  clinicId: string;
}

export function BranchManagement({ clinicId }: BranchManagementProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.branches");
  const tStatus = useTranslations("enums.status");
  const [isOpen, setIsOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<string | null>(null);

  const { data: branches, isLoading } = useQuery({
    queryKey: ["branches", clinicId],
    queryFn: () => getBranches(clinicId),
  });

  const upsertMutation = useMutation({
    mutationFn: (data: Branch) => upsertBranch(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches", clinicId] });
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
      queryClient.invalidateQueries({ queryKey: ["branches", clinicId] });
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
    formState: { errors },
  } = useForm<Branch>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      clinic_id: clinicId,
      status: "active",
      is_main: false,
    },
  });

  const onOpenAdd = () => {
    setEditingBranch(null);
    reset({ clinic_id: clinicId, status: "active", is_main: false });
    setIsOpen(true);
  };

  const onEdit = (branch: Branch) => {
    setEditingBranch(branch);
    reset(branch);
    setIsOpen(true);
  };

  const onSubmit = (data: Branch) => {
    upsertMutation.mutate(data);
  };

  if (isLoading) return <div>{t("loading")}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <Button size="sm" onClick={onOpenAdd}>
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
              <TableHead>{t("colStatus")}</TableHead>
              <TableHead className="text-end">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {branches?.map((branch) => (
              <TableRow key={branch.id}>
                <TableCell className="font-medium">
                  {branch.name}
                  {branches.indexOf(branch) === 0 && (
                    <Badge
                      variant="outline"
                      className="ms-2 bg-primary/5 text-primary border-primary/20"
                    >
                      {t("mainBadge")}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>{branch.address || "-"}</TableCell>
                <TableCell>{branch.phone || "-"}</TableCell>
                <TableCell>
                  <Badge
                    variant={
                      branch.status === "active" ? "default" : "secondary"
                    }
                  >
                    {branch.status === "active" ? tStatus("active") : tStatus("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-end space-x-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onEdit(branch)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setBranchToDelete(branch.id!)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {branches?.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={5}
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
            <DialogDescription>
              {t("dialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="branch_name">{t("formName")}</Label>
              <Input
                id="branch_name"
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
              <Label htmlFor="address">{t("formAddress")}</Label>
              <Input id="address" {...register("address")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_phone">{t("formPhone")}</Label>
              <Input id="branch_phone" {...register("phone")} />
            </div>
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
            <AlertDialogDescription>
              {t("deleteDesc")}
            </AlertDialogDescription>
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
