"use client";

import { useTransition } from "react";
import { useRouter, Link } from "@/i18n/routing";
import { toast } from "sonner";
import { Edit2, Power, PowerOff, Loader2 } from "lucide-react";

import { toggleMedicationActive } from "@/app/actions/app-owner/medications";
import { Button } from "@/components/ui/button";

interface MedicationRowActionsProps {
  id: string;
  isActive: boolean;
  activateLabel: string;
  deactivateLabel: string;
}

export function MedicationRowActions({
  id,
  isActive,
  activateLabel,
  deactivateLabel,
}: MedicationRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const onToggle = () => {
    startTransition(async () => {
      const result = await toggleMedicationActive(id, !isActive);
      if (result && "error" in result) {
        toast.error("Failed to update medication.");
        return;
      }
      toast.success(isActive ? "Medication deactivated." : "Medication activated.");
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Button variant="ghost" size="icon" asChild>
        <Link href={`/app-owner/medications/${id}`}>
          <Edit2 className="h-4 w-4" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggle}
        disabled={isPending}
        title={isActive ? deactivateLabel : activateLabel}
      >
        {isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <PowerOff className="h-4 w-4 text-destructive" />
        ) : (
          <Power className="h-4 w-4 text-green-600" />
        )}
      </Button>
    </div>
  );
}
