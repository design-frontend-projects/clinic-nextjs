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
import { useTranslations } from "next-intl";

type RateAppointmentDialogProps = {
  appointmentId: string | null;
  onOpenChange: (open: boolean) => void;
};

export function RateAppointmentDialog({
  appointmentId,
  onOpenChange,
}: RateAppointmentDialogProps) {
  const queryClient = useQueryClient();
  const t = useTranslations("patient.rateDialog");
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
      toast.error(t("toastChooseRating"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitReview(parsed.data);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(t("toastSubmitted"));
      queryClient.invalidateQueries({ queryKey: ["my-reviews"] });
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t("toastFailed"));
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
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("description")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-1 py-4" role="radiogroup" aria-label={t("ratingAriaLabel")}>
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={rating === value}
              aria-label={t("starCount", { count: value })}
              className="flex h-11 w-11 items-center justify-center rounded-md transition-colors hover:bg-muted"
              onMouseEnter={() => setHovered(value)}
              onMouseLeave={() => setHovered(0)}
              onClick={() => setRating(value)}
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  value <= (hovered || rating)
                    ? "fill-primary text-primary"
                    : "text-muted-foreground",
                )}
              />
            </button>
          ))}
        </div>

        <Textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={t("commentPlaceholder")}
          maxLength={1000}
          rows={4}
        />

        <DialogFooter className="mt-2">
          <Button
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rating === 0}>
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
