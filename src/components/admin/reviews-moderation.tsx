"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { listClinicReviews, moderateReview } from "@/app/actions/reviews";
import type { ClinicReview, ReviewStatus } from "@/types/review.types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/status-badge";
import { StarRating } from "@/components/ui/star-rating";

export function ReviewsModeration() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ReviewStatus>("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["clinic-reviews", statusFilter],
    queryFn: () => listClinicReviews(statusFilter),
  });

  const reviews: ClinicReview[] = Array.isArray(data) ? data : [];
  const loadError = data && !Array.isArray(data) ? data.error : null;

  const mutation = useMutation({
    mutationFn: (input: { review_id: string; status: "approved" | "rejected" }) =>
      moderateReview(input),
    onSuccess: (result, input) => {
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(
        input.status === "approved" ? "Review approved." : "Review rejected.",
      );
      queryClient.invalidateQueries({ queryKey: ["clinic-reviews"] });
    },
    onError: () => toast.error("Failed to update the review."),
  });

  return (
    <div className="space-y-4">
      <Tabs
        value={statusFilter}
        onValueChange={(value) => setStatusFilter(value as ReviewStatus)}
      >
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rating</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Doctor</TableHead>
            <TableHead>Visit date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-end">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={7} className="py-8 text-center">
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
              </TableCell>
            </TableRow>
          ) : loadError ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-destructive">
                {loadError}
              </TableCell>
            </TableRow>
          ) : reviews.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No {statusFilter} reviews.
              </TableCell>
            </TableRow>
          ) : (
            reviews.map((review) => (
              <TableRow key={review.id}>
                <TableCell>
                  <StarRating rating={review.rating} />
                </TableCell>
                <TableCell className="max-w-xs">
                  <p className="truncate" title={review.comment ?? undefined}>
                    {review.comment || "—"}
                  </p>
                </TableCell>
                <TableCell>{review.patient_name}</TableCell>
                <TableCell>{review.doctor_name ?? "—"}</TableCell>
                <TableCell>
                  {review.appointment_date
                    ? format(new Date(review.appointment_date), "PP")
                    : "—"}
                </TableCell>
                <TableCell>
                  <StatusBadge status={review.status} />
                </TableCell>
                <TableCell className="text-end">
                  {review.status === "pending" ? (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ review_id: review.id, status: "approved" })
                        }
                      >
                        <Check className="me-1.5 h-3.5 w-3.5" />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={mutation.isPending}
                        onClick={() =>
                          mutation.mutate({ review_id: review.id, status: "rejected" })
                        }
                      >
                        <X className="me-1.5 h-3.5 w-3.5" />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
