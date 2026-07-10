"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { isBypassRole } from "@/lib/rbac";
import { requireCurrentPatient } from "@/lib/patient-auth";
import {
  submitReviewSchema,
  moderateReviewSchema,
  type SubmitReviewData,
  type ReviewStatus,
  type MyReview,
  type ClinicReview,
} from "@/types/review.types";

/** Clinic admins/owners moderate reviews; other roles are rejected. */
async function requireReviewModerator() {
  const tenant = await requireTenantInfo();
  if (!isBypassRole(tenant.role)) {
    throw new Error("You are not allowed to moderate reviews.");
  }
  return tenant;
}

/** Patient rates one of their own completed appointments. */
export async function submitReview(data: SubmitReviewData) {
  try {
    const parsed = submitReviewSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid review data" };
    }

    const { tenant, patient } = await requireCurrentPatient();

    const appointment = await prisma.appointments.findFirst({
      where: {
        id: parsed.data.appointment_id,
        clinic_id: tenant.clinicId,
        patient_id: patient.id,
        status: "completed",
      },
      select: { id: true, doctor_id: true },
    });

    if (!appointment) {
      return { error: "Only your own completed appointments can be rated." };
    }

    const existing = await prisma.appointment_reviews.findUnique({
      where: { appointment_id: appointment.id },
      select: { id: true },
    });
    if (existing) {
      return { error: "This appointment has already been rated." };
    }

    await prisma.appointment_reviews.create({
      data: {
        appointment_id: appointment.id,
        clinic_id: tenant.clinicId,
        patient_id: patient.id,
        doctor_id: appointment.doctor_id,
        rating: parsed.data.rating,
        comment: parsed.data.comment || null,
        status: "pending",
      },
    });

    revalidatePath("/patient/appointments");
    return { success: true };
  } catch (error) {
    console.error("submitReview error:", error);
    return { error: "Failed to submit your review." };
  }
}

/** The logged-in patient's reviews, keyed by appointment. */
export async function getMyReviews(): Promise<MyReview[]> {
  try {
    const { tenant, patient } = await requireCurrentPatient();

    const reviews = await prisma.appointment_reviews.findMany({
      where: { clinic_id: tenant.clinicId, patient_id: patient.id },
      select: { appointment_id: true, rating: true, status: true },
    });

    return reviews.map((r) => ({
      appointment_id: r.appointment_id,
      rating: r.rating,
      status: r.status as ReviewStatus,
    }));
  } catch {
    return [];
  }
}

/** All reviews for the moderator's clinic, optionally filtered by status. */
export async function listClinicReviews(
  status?: ReviewStatus,
): Promise<ClinicReview[] | { error: string }> {
  try {
    const tenant = await requireReviewModerator();

    const reviews = await prisma.appointment_reviews.findMany({
      where: {
        clinic_id: tenant.clinicId,
        ...(status ? { status } : {}),
      },
      orderBy: { created_at: "desc" },
      take: 200,
      select: {
        id: true,
        rating: true,
        comment: true,
        status: true,
        created_at: true,
        appointments: { select: { appointment_date: true } },
        patients: { select: { first_name: true, last_name: true } },
        doctor: { select: { full_name: true } },
      },
    });

    return reviews.map((r) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      status: r.status as ReviewStatus,
      created_at: r.created_at.toISOString(),
      appointment_date: r.appointments.appointment_date?.toISOString() ?? null,
      patient_name:
        [r.patients.first_name, r.patients.last_name].filter(Boolean).join(" ") ||
        "Patient",
      doctor_name: r.doctor?.full_name ?? null,
    }));
  } catch (error) {
    console.error("listClinicReviews error:", error);
    return { error: "Failed to load reviews." };
  }
}

/** Approve or reject a pending review (clinic-scoped). */
export async function moderateReview(data: { review_id: string; status: "approved" | "rejected" }) {
  try {
    const parsed = moderateReviewSchema.safeParse(data);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message || "Invalid input" };
    }

    const tenant = await requireReviewModerator();

    const result = await prisma.appointment_reviews.updateMany({
      where: { id: parsed.data.review_id, clinic_id: tenant.clinicId },
      data: {
        status: parsed.data.status,
        approved_by: tenant.profileId,
        approved_at: new Date(),
      },
    });

    if (result.count === 0) {
      return { error: "Review not found." };
    }

    revalidateTag("public-testimonials", "max");
    revalidatePath("/admin/reviews");
    return { success: true };
  } catch (error) {
    console.error("moderateReview error:", error);
    return { error: "Failed to update the review." };
  }
}
