"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { upsertSpecialty } from "@/app/actions/app-owner/specialties";
import {
  specialtySchema,
  type SpecialtyFormData,
} from "@/types/specialty.types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpecialtyEditorProps {
  specialty?: Partial<SpecialtyFormData> & { id?: string };
}

export function SpecialtyEditor({ specialty }: SpecialtyEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<SpecialtyFormData>({
    resolver: zodResolver(specialtySchema),
    defaultValues: {
      id: specialty?.id,
      name: specialty?.name ?? "",
      name_ar: specialty?.name_ar ?? "",
      description: specialty?.description ?? "",
      is_active: specialty?.is_active ?? true,
      display_order: specialty?.display_order ?? 0,
    },
  });

  const onSubmit = (data: SpecialtyFormData) => {
    startTransition(async () => {
      const result = await upsertSpecialty(data);
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(specialty?.id ? "Specialty updated." : "Specialty created.");
      router.push("/app-owner/specialties");
      router.refresh();
    });
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Specialty Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name (English) *</Label>
              <Input
                id="name"
                {...form.register("name")}
                placeholder="Cardiology"
              />
              {form.formState.errors.name && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name_ar">Name (Arabic)</Label>
              <Input
                id="name_ar"
                dir="rtl"
                {...form.register("name_ar")}
                placeholder="أمراض القلب"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...form.register("description")}
              placeholder="Short description of the specialty"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                {...form.register("display_order")}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  defaultChecked={form.getValues("is_active")}
                  onCheckedChange={(c) =>
                    form.setValue("is_active", Boolean(c))
                  }
                />
                Active (available for selection)
              </label>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/app-owner/specialties")}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {specialty?.id ? "Save Specialty" : "Create Specialty"}
        </Button>
      </div>
    </form>
  );
}
