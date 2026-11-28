"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, ExternalLink, FlaskConical, Loader2, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { confirmLabOrder } from "@/app/actions/doctor";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";

export interface ConfirmableLabResult {
  id: string;
  result_file_url: string | null;
  result_data: unknown;
  received_at: Date | string | null;
}

export interface ConfirmableLabOrder {
  id: string;
  test_name: string | null;
  external_lab_provider: string | null;
  patient_name: string;
  created_at: Date | string;
  status: string;
  doctor_notes: string | null;
  confirmed_at: Date | string | null;
  confirmed_by: string | null;
  confirmed_by_name: string | null;
  lab_results?: ConfirmableLabResult[];
}

interface ConfirmLabOrderDialogProps {
  labOrder: ConfirmableLabOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentDoctorProfileId?: string | null;
  currentAppointmentId?: string;
  readOnly?: boolean;
  onConfirmed?: () => void;
}

const formSchema = z.object({
  doctor_notes: z.string().trim().max(2000).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function isSafeResultUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  return (
    url.startsWith("https://") ||
    url.startsWith("http://") ||
    url.startsWith("/")
  );
}

export function ConfirmLabOrderDialog({
  labOrder,
  open,
  onOpenChange,
  currentDoctorProfileId,
  currentAppointmentId,
  readOnly = false,
  onConfirmed,
}: ConfirmLabOrderDialogProps) {
  const t = useTranslations("pages.doctor.labs");
  const queryClient = useQueryClient();

  const isAlreadyConfirmed = labOrder?.status === "confirmed";
  const canEditNotes =
    !readOnly &&
    (!isAlreadyConfirmed ||
      (Boolean(currentDoctorProfileId) &&
        labOrder?.confirmed_by === currentDoctorProfileId));

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      doctor_notes: labOrder?.doctor_notes ?? "",
    },
  });

  useEffect(() => {
    if (open && labOrder) {
      form.reset({
        doctor_notes: labOrder.doctor_notes ?? "",
      });
    }
  }, [open, labOrder, form]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!labOrder) return { error: "Lab order not found" };
      return confirmLabOrder({
        lab_order_id: labOrder.id,
        doctor_notes: values.doctor_notes || undefined,
        current_appointment_id: currentAppointmentId,
      });
    },
    onSuccess: (result) => {
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["doctor-lab-orders"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      toast.success(
        isAlreadyConfirmed ? t("toastNotesUpdated") : t("toastConfirmed"),
      );
      onConfirmed?.();
      onOpenChange(false);
    },
    onError: () => {
      toast.error(t("toastFailed"));
    },
  });

  if (!labOrder) return null;

  const attachedResults = (labOrder.lab_results ?? []).filter(
    (r) => isSafeResultUrl(r.result_file_url) || r.result_data != null,
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-accent-yellow" />
            {t("confirmDialogTitle")}
          </DialogTitle>
          <DialogDescription>{t("confirmDialogDesc")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-muted/30 p-3.5 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">
                  {labOrder.test_name || t("routineLab")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {labOrder.external_lab_provider || t("inHouse")}
                </p>
              </div>
              <StatusBadge status={labOrder.status} />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30 text-xs">
              <div>
                <span className="text-muted-foreground">{t("colPatient")}: </span>
                <span className="font-medium text-foreground">
                  {labOrder.patient_name}
                </span>
              </div>
              <div className="text-end">
                <span className="text-muted-foreground">{t("colOrderDate")}: </span>
                <span className="font-medium text-foreground">
                  {format(new Date(labOrder.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>

            {isAlreadyConfirmed && (
              <div className="flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 px-2.5 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>
                  {t("confirmedBy", {
                    name: labOrder.confirmed_by_name || t("unknownPatient"),
                    date: labOrder.confirmed_at
                      ? format(new Date(labOrder.confirmed_at), "MMM d, yyyy h:mm a")
                      : "—",
                  })}
                </span>
              </div>
            )}

            {attachedResults.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-border/30">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("resultsAttached")}
                </p>
                {attachedResults.map((res, idx) => (
                  <div key={res.id || idx} className="text-xs space-y-1">
                    {isSafeResultUrl(res.result_file_url) && (
                      <a
                        href={res.result_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-accent-blue hover:underline font-medium"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {res.result_file_url}
                      </a>
                    )}
                    {res.result_data != null && (
                      <pre className="rounded-md bg-background/80 p-2 text-[11px] overflow-x-auto border border-border/40">
                        {JSON.stringify(res.result_data, null, 2)}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => mutation.mutate(values))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="doctor_notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("notesLabel")}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("notesPlaceholder")}
                        className="min-h-[110px]"
                        disabled={!canEditNotes || mutation.isPending}
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter className="gap-2 pt-2 border-t">
                {!canEditNotes ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                  >
                    {t("btnClose")}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => onOpenChange(false)}
                      disabled={mutation.isPending}
                    >
                      {t("btnCancel")}
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                      {mutation.isPending ? (
                        <Loader2 className="me-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="me-2 h-4 w-4" />
                      )}
                      {isAlreadyConfirmed
                        ? t("btnUpdateNotes")
                        : t("btnConfirmSave")}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
