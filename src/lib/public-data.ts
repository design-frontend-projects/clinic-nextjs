import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import type { PublicPlan } from "@/types/subscription.types";

/**
 * Public (unauthenticated) read-only queries for the marketing landing page
 * and the onboarding plan picker. Every function:
 * - whitelists fields via `select` (never `include`) so internal data can't leak,
 * - returns plain serializable values (no Prisma Decimal),
 * - swallows DB errors into empty/zero fallbacks so public pages never 500.
 */

export type PublicStats = {
  doctors: number;
  clinics: number;
  specialties: number;
  patients: number;
};

export type PublicSpecialty = {
  id: string;
  name: string;
  name_ar: string | null;
  doctorCount: number;
};

export type PublicTestimonial = {
  id: string;
  rating: number;
  comment: string | null;
  patientName: string;
  clinicName: string;
  createdAt: string;
};

export const getPublicStats = unstable_cache(
  async (): Promise<PublicStats> => {
    try {
      const [doctors, clinics, specialties, patients] = await Promise.all([
        prisma.profiles.count({ where: { role: "doctor", status: "active" } }),
        prisma.clinics.count({ where: { status: { not: "suspended" } } }),
        prisma.specialties.count({ where: { is_active: true } }),
        prisma.patients.count(),
      ]);
      return { doctors, clinics, specialties, patients };
    } catch (error) {
      console.error("[public-data] getPublicStats failed", error);
      return { doctors: 0, clinics: 0, specialties: 0, patients: 0 };
    }
  },
  ["public-stats"],
  { revalidate: 300, tags: ["public-stats"] },
);

export const getPublicSpecialties = unstable_cache(
  async (): Promise<PublicSpecialty[]> => {
    try {
      const [specialties, counts] = await Promise.all([
        prisma.specialties.findMany({
          where: { is_active: true },
          select: { id: true, name: true, name_ar: true },
          orderBy: [{ display_order: "asc" }, { name: "asc" }],
          take: 8,
        }),
        prisma.doctor_specialties.groupBy({
          by: ["specialty_id"],
          _count: { _all: true },
        }),
      ]);
      const countBySpecialty = new Map(
        counts.map((c) => [c.specialty_id, c._count._all]),
      );
      return specialties.map((s) => ({
        id: s.id,
        name: s.name,
        name_ar: s.name_ar,
        doctorCount: countBySpecialty.get(s.id) ?? 0,
      }));
    } catch (error) {
      console.error("[public-data] getPublicSpecialties failed", error);
      return [];
    }
  },
  ["public-specialties"],
  { revalidate: 300, tags: ["public-specialties"] },
);

export const getPublicPlans = unstable_cache(
  async (): Promise<PublicPlan[]> => {
    try {
      const plans = await prisma.subscription_plans.findMany({
        where: { status: "active", deleted_at: null },
        orderBy: { display_order: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          billing_period: true,
          trial_days: true,
          price: true,
          currency: true,
          max_users: true,
          max_branches: true,
          max_doctors: true,
          public_notes: true,
          display_order: true,
          features: {
            select: { feature_name: true, is_enabled: true },
          },
        },
      });
      return plans.map((plan) => ({
        ...plan,
        price: Number(plan.price),
      }));
    } catch (error) {
      console.error("[public-data] getPublicPlans failed", error);
      return [];
    }
  },
  ["public-plans"],
  { revalidate: 300, tags: ["public-plans"] },
);

export const getPublicTestimonials = unstable_cache(
  async (): Promise<PublicTestimonial[]> => {
    try {
      const reviews = await prisma.appointment_reviews.findMany({
        where: { status: "approved", comment: { not: null } },
        orderBy: { approved_at: "desc" },
        take: 9,
        select: {
          id: true,
          rating: true,
          comment: true,
          created_at: true,
          patients: { select: { first_name: true, last_name: true } },
          clinics: { select: { name: true } },
        },
      });
      return reviews.map((review) => {
        const firstName = review.patients.first_name?.trim() || "Patient";
        const lastInitial = review.patients.last_name?.trim()?.charAt(0);
        return {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          patientName: lastInitial ? `${firstName} ${lastInitial}.` : firstName,
          clinicName: review.clinics.name,
          createdAt: review.created_at.toISOString(),
        };
      });
    } catch (error) {
      console.error("[public-data] getPublicTestimonials failed", error);
      return [];
    }
  },
  ["public-testimonials"],
  { revalidate: 300, tags: ["public-testimonials"] },
);
