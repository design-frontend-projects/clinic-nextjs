"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { createEncounter } from "@/app/actions/doctor";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

const encounterSchema = z.object({
  diagnosis: z.string().min(2, "Diagnosis is required"),
  notes: z.string().min(5, "Visit notes are required"),
  treatment_plan: z.string().optional(),
});

type EncounterFormValues = z.infer<typeof encounterSchema>;

interface EncounterFormProps {
  patientId: string;
  /**
   * When present, the saved encounter is tied to this appointment and the
   * appointment is auto-completed server-side (see `createEncounter`).
   */
  appointmentId?: string;
}

export function EncounterForm({ patientId, appointmentId }: EncounterFormProps) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<EncounterFormValues>({
    resolver: zodResolver(encounterSchema),
    defaultValues: {
      diagnosis: "",
      notes: "",
      treatment_plan: "",
    },
  });

  function onSubmit(data: EncounterFormValues) {
    startTransition(async () => {
      try {
        await createEncounter(patientId, { ...data, appointment_id: appointmentId });
        toast.success(
          appointmentId
            ? "Encounter saved and appointment completed!"
            : "Encounter saved successfully!",
        );
        form.reset();
      } catch {
        toast.error("Failed to save encounter. Please try again.");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="diagnosis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Diagnosis</FormLabel>
              <FormControl>
                <Input
                  placeholder="Primary diagnosis (e.g., Acute Pharyngitis)"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Consultation Notes</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Record symptoms, observations, and findings..."
                  className="min-h-[120px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="treatment_plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Treatment Plan</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Instructions, rest prescriptions, follow-up..."
                  className="min-h-[80px]"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end pt-4">
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Encounter
          </Button>
        </div>
      </form>
    </Form>
  );
}
