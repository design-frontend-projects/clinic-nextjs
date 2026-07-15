"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { searchPatients } from "@/app/actions/admin";
import {
  createInvoice,
  getInsuranceDeductionPreview,
} from "@/app/actions/billing";
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
import { Separator } from "@/components/ui/separator";

type PatientOption = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
};

type LineItem = { description: string; quantity: string; unit_price: string };

const emptyItem: LineItem = { description: "", quantity: "1", unit_price: "" };

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
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();

  const [patientQuery, setPatientQuery] = useState("");
  const [patient, setPatient] = useState<PatientOption | null>(null);
  const [items, setItems] = useState<LineItem[]>([emptyItem]);
  const [applyInsurance, setApplyInsurance] = useState(true);

  const debouncedQuery = useDebounced(patientQuery, 300);

  const { data: matches = [] } = useQuery({
    queryKey: ["patient-search", debouncedQuery],
    queryFn: () => searchPatients(debouncedQuery),
    enabled: open && !patient && debouncedQuery.length >= 2,
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

  const { data: preview } = useQuery({
    queryKey: ["deduction-preview", patient?.id, gross],
    queryFn: () => getInsuranceDeductionPreview(patient!.id, gross),
    enabled: open && !!patient && gross > 0,
  });

  const deduction = applyInsurance && preview ? preview.deduction : 0;
  const net = Math.round((gross - deduction) * 100) / 100;

  const reset = () => {
    setPatientQuery("");
    setPatient(null);
    setItems([emptyItem]);
    setApplyInsurance(true);
  };

  const updateItem = (index: number, patch: Partial<LineItem>) => {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Bill a patient; eligible insurance is deducted automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Patient picker */}
          <div className="space-y-2">
            <Label>Patient *</Label>
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
                <Button variant="ghost" size="sm" onClick={() => setPatient(null)}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={patientQuery}
                    onChange={(e) => setPatientQuery(e.target.value)}
                    placeholder="Search by name, phone, or email..."
                    className="pl-8"
                  />
                </div>
                {matches.length > 0 && (
                  <div className="rounded-lg border divide-y">
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

          {/* Line items */}
          <div className="space-y-2">
            <Label>Items *</Label>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={item.description}
                    onChange={(e) => updateItem(index, { description: e.target.value })}
                    placeholder="Consultation, procedure..."
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, { quantity: e.target.value })}
                    className="w-16"
                    aria-label="Quantity"
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={(e) => updateItem(index, { unit_price: e.target.value })}
                    placeholder="0.00"
                    className="w-24"
                    aria-label="Unit price"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={items.length === 1}
                    onClick={() =>
                      setItems((prev) => prev.filter((_, i) => i !== index))
                    }
                    aria-label="Remove item"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setItems((prev) => [...prev, emptyItem])}
            >
              <Plus className="mr-2 h-3.5 w-3.5" />
              Add Item
            </Button>
          </div>

          {/* Insurance + totals */}
          <Separator />
          {patient && gross > 0 && preview && (
            <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
              <div className="flex-1 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{preview.provider_name}</p>
                  <label className="flex items-center gap-2 text-xs font-normal">
                    <Checkbox
                      checked={applyInsurance}
                      onCheckedChange={(v) => setApplyInsurance(v === true)}
                    />
                    Apply insurance
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
              </div>
            </div>
          )}
          {patient && gross > 0 && !preview && (
            <p className="text-xs text-muted-foreground">
              No eligible insurance for this patient — full amount is payable.
            </p>
          )}

          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total</span>
              <span className="font-medium">${gross.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Insurance deduction</span>
              <span className="font-medium text-emerald-600">
                −${deduction.toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Patient pays</span>
              <span>${net.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
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
            {isPending ? "Creating..." : "Create Invoice"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
