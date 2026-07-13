"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { upsertMedication } from "@/app/actions/app-owner/medications";
import {
  medicationSchema,
  type MedicationFormData,
  type ClinicOption,
} from "@/types/medication.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface MedicationEditorProps {
  clinics: ClinicOption[];
  medication?: Partial<MedicationFormData> & { id?: string };
  defaultClinicId?: string;
}

export function MedicationEditor({
  clinics,
  medication,
  defaultClinicId,
}: MedicationEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isEditing = Boolean(medication?.id);

  const form = useForm<MedicationFormData>({
    resolver: zodResolver(medicationSchema),
    defaultValues: {
      id: medication?.id,
      clinic_id: medication?.clinic_id ?? defaultClinicId ?? clinics[0]?.id ?? "",
      generic_name: medication?.generic_name ?? "",
      brand_name: medication?.brand_name ?? "",
      strength: medication?.strength ?? "",
      form: medication?.form ?? "",
      route: medication?.route ?? "",
      manufacturer: medication?.manufacturer ?? "",
      barcode: medication?.barcode ?? "",
      code: medication?.code ?? "",
      code_system: medication?.code_system ?? "",
      price: medication?.price ?? null,
      is_active: medication?.is_active ?? true,
    },
  });

  const clinicId = form.watch("clinic_id");

  const onSubmit = (data: MedicationFormData) => {
    startTransition(async () => {
      const result = await upsertMedication(data);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(isEditing ? "Medication updated." : "Medication created.");
      router.push(`/app-owner/medications?clinic=${data.clinic_id}`);
      router.refresh();
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Medication Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clinic_id">Clinic *</Label>
            <Select
              value={clinicId}
              onValueChange={(val) =>
                form.setValue("clinic_id", val, { shouldValidate: true })
              }
              disabled={isEditing}
            >
              <SelectTrigger id="clinic_id">
                <SelectValue placeholder="Select a clinic" />
              </SelectTrigger>
              <SelectContent>
                {clinics.map((clinic) => (
                  <SelectItem key={clinic.id} value={clinic.id}>
                    {clinic.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clinic_id && (
              <p className="text-xs text-destructive">
                {form.formState.errors.clinic_id.message}
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="generic_name">Generic Name *</Label>
              <Input
                id="generic_name"
                {...form.register("generic_name")}
                placeholder="Amoxicillin"
              />
              {form.formState.errors.generic_name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.generic_name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand Name</Label>
              <Input
                id="brand_name"
                {...form.register("brand_name")}
                placeholder="Amoxil"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="strength">Strength</Label>
              <Input id="strength" {...form.register("strength")} placeholder="500mg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form">Form</Label>
              <Input id="form" {...form.register("form")} placeholder="Capsule" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="route">Route</Label>
              <Input id="route" {...form.register("route")} placeholder="Oral" />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" {...form.register("manufacturer")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price">Price</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                min="0"
                {...form.register("price")}
                placeholder="0.00"
              />
              {form.formState.errors.price && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.price.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="barcode">Barcode</Label>
              <Input id="barcode" {...form.register("barcode")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input id="code" {...form.register("code")} placeholder="RxNorm / ATC" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code_system">Code System</Label>
              <Input
                id="code_system"
                {...form.register("code_system")}
                placeholder="RxNorm"
              />
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                defaultChecked={form.getValues("is_active") ?? true}
                onCheckedChange={(c) => form.setValue("is_active", Boolean(c))}
              />
              Active (available for prescribing / dispensing)
            </label>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() =>
            router.push(`/app-owner/medications?clinic=${clinicId}`)
          }
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEditing ? "Save Medication" : "Create Medication"}
        </Button>
      </div>
    </form>
  );
}
