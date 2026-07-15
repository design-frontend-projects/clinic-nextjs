import { z } from "zod";

export const reviewStatusEnum = z.enum(["pending", "approved", "rejected"]);
export type ReviewStatus = z.infer<typeof reviewStatusEnum>;

/** Patient submits a rating for one of their completed appointments. */
export const submitReviewSchema = z.object({
  appointment_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type SubmitReviewData = z.infer<typeof submitReviewSchema>;

/** Admin approves or rejects a pending review. */
export const moderateReviewSchema = z.object({
  review_id: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
});

export type ModerateReviewData = z.infer<typeof moderateReviewSchema>;

/** A patient's own review, keyed by appointment for the portal UI. */
export type MyReview = {
  appointment_id: string;
  rating: number;
  status: ReviewStatus;
};

/** Review row shown in the clinic moderation table. */
export type ClinicReview = {
  id: string;
  rating: number;
  comment: string | null;
  status: ReviewStatus;
  created_at: string;
  appointment_date: string | null;
  patient_name: string;
  doctor_name: string | null;
};

/** An approved review shown to the doctor who received it. */
export type DoctorReview = {
  id: string;
  rating: number;
  comment: string | null;
  /** `approved_at` when available, otherwise `created_at`; ISO string. */
  created_at: string;
  appointment_date: string | null;
  patient_name: string;
};

/** Aggregate rating summary for a doctor's approved reviews. */
export type DoctorReviewStats = {
  /** Mean rating rounded to 1 decimal; 0 when there are no approved reviews. */
  average: number;
  /** Number of approved reviews. */
  count: number;
};
