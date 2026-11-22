"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  linkBranchToClinic,
  unlinkBranchFromClinic,
  setClinicPrimaryBranch,
} from "@/app/actions/clinic";
import type {
  ClinicLinkedBranch,
  OwnerBranchItem,
} from "@/types/clinic.types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Link2, MapPin, Plus, Star, Unlink } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

interface ClinicBranchesPanelProps {
  clinicId: string;
  linkedBranches: ClinicLinkedBranch[];
  ownerBranches: OwnerBranchItem[];
  onQuickAddBranch: (clinicId: string) => void;
}

export function ClinicBranchesPanel({
  clinicId,
  linkedBranches,
  ownerBranches,
  onQuickAddBranch,
}: ClinicBranchesPanelProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("admin.branches");
  const tStatus = useTranslations("enums.status");
  const [branchToUnlink, setBranchToUnlink] =
    useState<ClinicLinkedBranch | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["clinics"] });
    queryClient.invalidateQueries({ queryKey: ["owner-branches"] });
    queryClient.invalidateQueries({ queryKey: ["branches", clinicId] });
    queryClient.invalidateQueries({ queryKey: ["owner-clinics-branches"] });
  };

  const linkMutation = useMutation({
    mutationFn: (branchId: string) => linkBranchToClinic(clinicId, branchId),
    onSuccess: () => {
      invalidate();
      toast.success(t("toastLinked"));
    },
    onError: (error) => {
      toast.error(error.message || t("toastLinkFailed"));
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (branchId: string) =>
      unlinkBranchFromClinic(clinicId, branchId),
    onSuccess: () => {
      invalidate();
      toast.success(t("toastUnlinked"));
      setBranchToUnlink(null);
    },
    onError: (error) => {
      toast.error(error.message || t("toastUnlinkFailed"));
    },
  });

  const primaryMutation = useMutation({
    mutationFn: (branchId: string) =>
      setClinicPrimaryBranch(clinicId, branchId),
    onSuccess: () => {
      invalidate();
      toast.success(t("toastPrimaryUpdated"));
    },
    onError: (error) => {
      toast.error(error.message || t("toastPrimaryFailed"));
    },
  });

  const linkedIds = new Set(linkedBranches.map((b) => b.id));
  const availableToLink = ownerBranches.filter(
    (b) => b.status === "active" && !linkedIds.has(b.id),
  );

  const isLastBranch = linkedBranches.length <= 1;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-muted-foreground">
          {t("linkedBranchesTitle")} ({linkedBranches.length})
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={linkMutation.isPending}>
              <Link2 className="me-1.5 h-3.5 w-3.5" />
              {t("linkBranch")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel>{t("selectBranchToLink")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableToLink.length > 0 ? (
              availableToLink.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => linkMutation.mutate(branch.id)}
                  className="flex flex-col items-start gap-0.5"
                >
                  <span className="font-medium">{branch.name}</span>
                  {branch.address && (
                    <span className="text-xs text-muted-foreground truncate w-full">
                      {branch.address}
                    </span>
                  )}
                </DropdownMenuItem>
              ))
            ) : (
              <div className="px-2 py-2 text-xs text-muted-foreground italic">
                {t("allBranchesLinked")}
              </div>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onQuickAddBranch(clinicId)}
              className="text-primary font-medium"
            >
              <Plus className="me-1.5 h-3.5 w-3.5" />
              {t("newBranchShortcut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-2">
        {linkedBranches.map((branch) => (
          <div
            key={branch.id}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium truncate">{branch.name}</span>
                {branch.is_primary && (
                  <Badge
                    variant="outline"
                    className="bg-primary/5 text-primary border-primary/20 text-[10px] py-0"
                  >
                    {t("mainBadge")}
                  </Badge>
                )}
                {branch.status === "inactive" && (
                  <Badge variant="secondary" className="text-[10px] py-0">
                    {tStatus("inactive")}
                  </Badge>
                )}
              </div>
              {(branch.address || branch.phone) && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground truncate mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    {[branch.address, branch.phone].filter(Boolean).join(" • ")}
                  </span>
                </p>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {!branch.is_primary && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-primary"
                  onClick={() => primaryMutation.mutate(branch.id)}
                  disabled={primaryMutation.isPending}
                  title={t("setPrimary")}
                  aria-label={t("setPrimary")}
                >
                  <Star className={cn("h-3.5 w-3.5")} />
                </Button>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setBranchToUnlink(branch)}
                disabled={isLastBranch || unlinkMutation.isPending}
                title={isLastBranch ? t("lastBranchHint") : t("unlinkBranch")}
                aria-label={t("unlinkBranch")}
              >
                <Unlink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        {linkedBranches.length === 0 && (
          <div className="rounded-md border border-dashed py-4 text-center text-xs text-muted-foreground">
            {t("empty")}
          </div>
        )}
      </div>

      <AlertDialog
        open={!!branchToUnlink}
        onOpenChange={(open) => !open && setBranchToUnlink(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("unlinkTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("unlinkDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                branchToUnlink && unlinkMutation.mutate(branchToUnlink.id)
              }
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? t("unlinking") : t("unlinkBranch")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
