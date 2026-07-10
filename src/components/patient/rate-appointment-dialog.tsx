"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { submitReview } from "@/app/actions/reviews";
import { submitReviewSchema } from "@/types/review.types";

type RateAppointmentDialogProps = {
  appointmentId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function RateAppointmentDialog({
  appointmentId,
  onOpenChange,
}: RateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setRating(0);
    setHovered(0);
    setComment("");
  };

  const handleSubmit = async () => {
    if (!appointmentId) return;

    const parsed = submitReviewSchema.safeParse({
      appointment_id: appointmentId,
      rating,
      comment: comment.trim() || undefined,
    });
    if (!parsed.success) {
      toast.error("Please choose a star rating.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitReview(parsed.data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Thank you! Your review is awaiting approval.");
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      reset();
      onOpenChange(false);
    } catch {
      toast.error("Failed to submit your review.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={Boolean(appointmentId)}
      onOpenChange={(open) => {
        if (!open) reset();
        onOpenChange(open);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rate your appointment</DialogTitle>
          <DialogDescription>
            How was your visit? Your feedback helps the clinic improve.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1 py-4" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={`${value} star${value > 1 ? "s" : ""}`}
              className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-muted"
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(value)}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  value <= (hovered || rating)
                    ? "fill-fin text-fin"
                    : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder="Share a few words about your visit (optional)"
          maxLength={1000}
          rows={4}
        />

        <DialogFooter className="mt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            Submit review
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
