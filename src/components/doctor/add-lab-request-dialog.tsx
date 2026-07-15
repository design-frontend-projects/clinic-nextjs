"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { createLabOrder } from "@/app/actions/doctor";

const formSchema = z.object({
  test_name: z.string().trim().min(1, "Test name is required"),
  external_lab_provider: z.string().trim().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface AddLabRequestDialogProps {
  appointmentId: string | null;
  patientName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddLabRequestDialog({
  appointmentId,
  patientName,
  open,
  onOpenChange,
}: AddLabRequestDialogProps) {
  const queryClient = useQueryClient();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { test_name: "", external_lab_provider: "" },
  });

  // Reset the form whenever the dialog opens for a different appointment.
  useEffect(() => {
    if (open) form.reset({ test_name: "", external_lab_provider: "" });
  }, [open, appointmentId, form]);

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!appointmentId) {
        return Promise.resolve({ error: "No appointment selected" });
      }
      return createLabOrder({
        appointment_id: appointmentId,
        test_name: data.test_name,
        external_lab_provider: data.external_lab_provider || undefined,
      });
    },
    onSuccess: (result) => {
      if (result && "error" in result) {
        toast.error(result.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      queryClient.invalidateQueries({ queryKey: ["doctor-lab-orders"] });
      toast.success("Lab request added");
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Failed to add lab request");
    },
  });

  function onSubmit(data: FormData) {
    mutation.mutate(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Lab Request</DialogTitle>
          <DialogDescription>
            Request a lab test for {patientName || "this patient"}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="test_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Test Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Complete Blood Count" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="external_lab_provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>External Lab Provider</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Add Request
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
