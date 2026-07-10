"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { upsertLookupValue } from "../actions";
import type { ResolvedLookupValue } from "../services/lookup.service";

interface LookupValueDialogProps {
  categoryCode: string;
  /** null = create new value; a global row here creates a tenant shadow. */
  value: ResolvedLookupValue | null;
  onClose: () => void;
}

export function LookupValueDialog({ categoryCode, value, onClose }: LookupValueDialogProps) {
  const t = useTranslations("settings.lookups");
  const tCommon = useTranslations("settings");
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [code, setCode] = useState(value?.code ?? "");
  const [label, setLabel] = useState(value?.label ?? "");
  const [labelAr, setLabelAr] = useState(value?.label_ar ?? "");
  const [displayOrder, setDisplayOrder] = useState(value?.display_order ?? 0);
  const [isActive, setIsActive] = useState(value?.is_active ?? true);

  const isEditing = value !== null;

  const handleSave = () => {
    startTransition(async () => {
      const result = await upsertLookupValue({
        categoryCode,
        code,
        label,
        label_ar: labelAr || null,
        display_order: displayOrder,
        is_active: isActive,
      });
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(tCommon("saved"));
      queryClient.invalidateQueries({ queryKey: ["lookups", categoryCode] });
      onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? t("editValue") : t("addValue")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lookup-code">{t("code")}</Label>
            <Input
              id="lookup-code"
              value={code}
              disabled={isEditing}
              placeholder="my_custom_value"
              onChange={(event) => setCode(event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="lookup-label">{t("label")}</Label>
              <Input id="lookup-label" value={label} onChange={(event) => setLabel(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lookup-label-ar">{t("labelAr")}</Label>
              <Input id="lookup-label-ar" dir="rtl" value={labelAr} onChange={(event) => setLabelAr(event.target.value)} />
            </div>
          </div>
          <div className="flex items-end gap-6">
            <div className="space-y-2">
              <Label htmlFor="lookup-order">{t("order")}</Label>
              <Input
                id="lookup-order"
                type="number"
                min={0}
                className="w-28"
                value={displayOrder}
                onChange={(event) => setDisplayOrder(Number(event.target.value))}
              />
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={isActive} onCheckedChange={(checked) => setIsActive(checked === true)} />
              <Label>{t("active")}</Label>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            {tCommon("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={isPending || !code || !label}>
            {isPending ? tCommon("saving") : tCommon("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
