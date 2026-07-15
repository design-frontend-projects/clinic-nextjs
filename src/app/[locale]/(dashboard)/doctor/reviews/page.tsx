"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Star } from "lucide-react";
import { getDoctorReviews, getDoctorReviewStats } from "@/app/actions/doctor";
import { StarRating } from "@/components/ui/star-rating";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function DoctorReviewsPage() {
  const { data: stats } = useQuery({
    queryKey: ["doctor-review-stats"],
    queryFn: () => getDoctorReviewStats(),
    retry: false,
  });

  const { data: reviews, isLoading } = useQuery({
    queryKey: ["doctor-reviews"],
    queryFn: () => getDoctorReviews(),
    retry: false,
  });

  const list = reviews ?? [];
  const average = stats?.average ?? 0;
  const count = stats?.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Reviews</h1>
        <p className="text-muted-foreground">
          Approved feedback from your patients
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5" />
            Average Rating
          </CardTitle>
          <CardDescription>Across all approved reviews</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <span className="text-4xl font-semibold tracking-tight">
              {count ? average : "—"}
            </span>
            <div className="space-y-1">
              <StarRating rating={Math.round(average)} />
              <p className="text-sm text-muted-foreground">
                {count} approved review{count === 1 ? "" : "s"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Previous Reviews</CardTitle>
          <CardDescription>Most recently approved first</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rating</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : list.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    No approved reviews yet.
                  </TableCell>
                </TableRow>
              ) : (
                list.map((review) => (
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
                    <TableCell>
                      {format(new Date(review.created_at), "PP")}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
