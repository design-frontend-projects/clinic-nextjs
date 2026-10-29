"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { searchPatients } from "@/app/actions/admin";
import {
  createInvoice,
  getBillingCatalogItems,
  getInsuranceDeductionPreview,
} from "@/app/actions/billing";
import {
  BILLING_ITEM_CATEGORIES,
  type BillingCatalogItemRow,
  type BillingItemCategory,
} from "@/types/billing.types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

type PatientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

export type EditableLineItem = {
  catalog_item_id: string | null;
  category: BillingItemCategory;
  description: string;
  quantity: string;
  unit_price: string;
};

export const emptyLineItem: EditableLineItem = {
  catalog_item_id: null,
  category: "consultation",
  description: "",
  quantity: "1",
  unit_price: "",
};

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);
  return debounced;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
}: CreateInvoiceDialogProps) {
  const t = useTranslations("admin.billing");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [patientQuery, setPatientQuery] = useState("");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [items, setItems] = useState<EditableLineItem[]>([emptyLineItem]);
  const [applyInsurance, setApplyInsurance] = useState(true);

  const debouncedQuery = useDebounced(patientQuery, 300);

  const { data: matches = [] } = useQuery({
    queryKey: ["patient-search", debouncedQuery],
    queryFn: () => searchPatients(debouncedQuery),
    enabled: open && !patient && debouncedQuery.length >= 2,
  });

  const { data: catalogItems = [] } = useQuery({
    queryKey: ["billing-catalog-items", "active"],
    queryFn: () => getBillingCatalogItems({ activeOnly: true }),
    enabled: open,
  });

  const gross = useMemo(
    () =>
      Math.round(
        items.reduce((sum, item) => {
          const qty = Number(item.quantity) || 0;
          const price = Number(item.unit_price) || 0;
          return sum + qty * price;
        }, 0) * 100,
      ) / 100,
    [items],
  );

  const previewItems = useMemo(
    () =>
      items.map((item) => ({
        category: item.category,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unit_price) || 0,
      })),
    [items],
  );

  const { data: preview } = useQuery({
    queryKey: ["deduction-preview", patient?.id, previewItems],
    queryFn: () => getInsuranceDeductionPreview(patient!.id, previewItems),
    enabled: open && !!patient && gross > 0,
  });

  const deduction = applyInsurance && preview ? preview.deduction : 0;
  const net = Math.round(Math.max(0, gross - deduction) * 100) / 100;

  const reset = () => {
    setPatientQuery("");
    setPatient(null);
    setItems([emptyLineItem]);
    setApplyInsurance(true);
  };

  const updateItem = (index: number, patch: Partial<EditableLineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  };

  const handleSelectCatalogItem = (
    index: number,
    catalogId: string,
    catalog: BillingCatalogItemRow[],
  ) => {
    if (catalogId === "__custom__") {
      updateItem(index, { catalog_item_id: null });
      return;
    }
    const found = catalog.find((c) => c.id === catalogId);
    if (!found) return;
    const label = locale === "ar" ? found.name_ar : found.name_en;
    updateItem(index, {
      catalog_item_id: found.id,
      category: found.category,
      description: label,
      unit_price: String(found.price),
    });
  };

  const onSubmit = () => {
    if (!patient) {
      toast.error("Select a patient first.");
      return;
    }
    startTransition(async () => {
      const result = await createInvoice({
        patient_id: patient.id,
        apply_insurance: applyInsurance,
        items: items.map((item) => ({
          catalog_item_id: item.catalog_item_id,
          category: item.category,
          description: item.description,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unit_price) || 0,
        })),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.deduction > 0
          ? `Invoice created — insurance covers $${result.deduction.toFixed(2)}, patient pays $${result.net.toFixed(2)}.`
          : "Invoice created.",
      );
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      reset();
      onOpenChange(false);
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("createInvoice")}</DialogTitle>
          <DialogDescription>
            {t("dialog.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient picker */}
          <div className="space-y-2">
            <Label>{t("table.patient")} *</Label>
            {patient ? (
              <div className="flex items-center justify-between rounded-lg border p-2.5">
                <div>
                  <p className="text-sm font-medium">
                    {patient.first_name} {patient.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {patient.phone || patient.email || ""}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPatient(null)}
                >
                  {t("dialog.changePatient")}
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder={t("dialog.searchPatientPlaceholder")}
                    className="pl-8"
                  />
                </div>
                {matches.length > 0 && (
                  <div className="divide-y rounded-lg border">
                    {matches.map((match) => (
                      <button
                        key={match.id}
                        type="button"
                        className="flex w-full items-center justify-between p-2.5 text-left text-sm hover:bg-muted/60"
                        onClick={() => setPatient(match)}
                      >
                        <span className="font-medium">
                          {match.first_name} {match.last_name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {match.phone || match.email || ""}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Line items with Catalog Dropdown */}
          <div className="space-y-3">
            <Label>{t("dialog.itemsLabel")} *</Label>
            <div className="space-y-3">
              {items.map((item, index) => {
                const lineSubtotal =
                  (Number(item.quantity) || 0) *
                  (Number(item.unit_price) || 0);
                return (
                  <div
                    key={index}
                    className="rounded-lg border bg-muted/20 p-3 space-y-2.5"
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("dialog.selectFromCatalog")}
                        </Label>
                        <Select
                          value={item.catalog_item_id ?? "__custom__"}
                          onValueChange={(val) =>
                            handleSelectCatalogItem(index, val, catalogItems)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t("dialog.chooseCatalogItem")}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__custom__">
                              {t("dialog.customItem")}
                            </SelectItem>
                            {catalogItems.map((catItem) => {
                              const displayName =
                                locale === "ar"
                                  ? `${catItem.name_ar} (${catItem.name_en})`
                                  : `${catItem.name_en} (${catItem.name_ar})`;
                              return (
                                <SelectItem key={catItem.id} value={catItem.id}>
                                  {displayName} — $
                                  {Number(catItem.price).toFixed(2)} [
                                  {t(`categories.${catItem.category}`)}]
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">
                          {t("catalog.categoryLabel")}
                        </Label>
                        <Select
                          value={item.category}
                          onValueChange={(v) =>
                            updateItem(index, {
                              category: v as BillingItemCategory,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {BILLING_ITEM_CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {t(`categories.${cat}`)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        value={item.description}
                        onChange={(e) =>
                          updateItem(index, { description: e.target.value })
                        }
                        placeholder={t("dialog.itemDescriptionPlaceholder")}
                        className="flex-1 min-w-[180px]"
                      />
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItem(index, { quantity: e.target.value })
                          }
                          className="w-20"
                          aria-label="Quantity"
                        />
                        <span className="text-xs text-muted-foreground">×</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) =>
                            updateItem(index, { unit_price: e.target.value })
                          }
                          placeholder="0.00"
                          className="w-28"
                          aria-label="Unit price"
                        />
                        <Badge
                          variant="outline"
                          className="min-w-[72px] justify-center font-mono text-xs"
                        >
                          ${lineSubtotal.toFixed(2)}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={items.length === 1}
                          onClick={() =>
                            setItems((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                          aria-label="Remove item"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, emptyLineItem])}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              {t("dialog.addItem")}
            </Button>
          </div>

          {/* Insurance + totals */}
          <Separator />
          {patient && gross > 0 && preview && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div className="flex-1 space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{preview.provider_name}</p>
                  <label className="flex items-center gap-2 text-xs font-normal">
                    <Checkbox
                      checked={applyInsurance}
                      onCheckedChange={(v) => setApplyInsurance(v === true)}
                    />
                    {t("dialog.applyInsurance")}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {preview.deduction_type === "fixed"
                    ? `Covers $${preview.deduction_value.toFixed(2)} per visit`
                    : `Covers ${preview.deduction_value}% of the invoice`}
                  {preview.remaining_visits !== null
                    ? ` · ${preview.remaining_visits} visit${preview.remaining_visits === 1 ? "" : "s"} left`
                    : ""}
                </p>
                {preview.breakdown && preview.breakdown.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {preview.breakdown.map((b) => (
                      <Badge
                        key={b.bucket}
                        variant="secondary"
                        className="text-[11px] font-normal"
                      >
                        {b.bucket}: −${b.deduction.toFixed(2)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          {patient && gross > 0 && !preview && (
            <p className="text-xs text-muted-foreground">
              {t("dialog.noEligibleInsurance")}
            </p>
          )}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("dialog.total")}</span>
              <span className="font-medium">${gross.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {t("dialog.insuranceDeduction")}
              </span>
              <span className="font-medium text-emerald-600">
                −${deduction.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>{t("table.patientPays")}</span>
              <span>${net.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={onSubmit}
            disabled={
              isPending ||
              !patient ||
              gross <= 0 ||
              items.some((item) => !item.description.trim())
            }
          >
            {isPending ? t("dialog.creating") : t("createInvoice")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
