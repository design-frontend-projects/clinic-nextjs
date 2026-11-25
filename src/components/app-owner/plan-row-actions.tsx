"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

import { Link } from "@/i18n/routing";
import { removeSubscriptionPlan } from "@/app/actions/app-owner/plans";
import { Button } from "@/components/ui/button";
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

interface PlanRowActionsProps {
  planId: string;
  planName: string;
  activeSubsCount: number;
}

export function PlanRowActions({
  planId,
  planName,
  activeSubsCount,
}: PlanRowActionsProps) {
  const router = useRouter();
  const t = useTranslations("appOwner.plans");
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const isBlocked = activeSubsCount > 0;

  const handleConfirmRemove = () => {
    if (isBlocked) return;

    startTransition(async () => {
      const result = await removeSubscriptionPlan(planId);
      if ("error" in result) {
        toast.error(result.error || t("toastRemoveFailed"));
        return;
      }
      toast.success(t("toastRemoved"));
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button
        variant="ghost"
        size="icon"
        asChild
        aria-label={t("edit")}
        title={t("edit")}
      >
        <Link href={`/app-owner/plans/${planId}`}>
          <Edit2 className="h-4 w-4" />
        </Link>
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t("remove")}
            title={t("remove")}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {isBlocked
                ? t("removeBlockedBySubs", {
                    name: planName,
                    count: activeSubsCount,
                  })
                : t("removeDescription", { name: planName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              {t("removeCancel")}
            </AlertDialogCancel>
            {!isBlocked && (
              <AlertDialogAction
                variant="destructive"
                disabled={isPending}
                onClick={(e) => {
                  e.preventDefault();
                  handleConfirmRemove();
                }}
              >
                {isPending && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("removeConfirm")}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
