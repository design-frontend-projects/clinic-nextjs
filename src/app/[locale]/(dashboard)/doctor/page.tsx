import {
  getDoctorDashboardStats,
  getDoctorReviews,
  getDoctorReviewStats,
} from "@/app/actions/doctor";
import type { DoctorReview, DoctorReviewStats } from "@/types/review.types";
import { DoctorDashboardClient } from "./doctor-dashboard-client";

export default async function DoctorDashboard() {
  let stats;
  try {
    stats = await getDoctorDashboardStats();
  } catch (error) {
    console.error("Failed to load doctor dashboard stats:", error);
    stats = {
      todayCount: 0,
      pendingLabCount: 0,
      todayAppointments: [],
      recentPatients: [],
    };
  }

  let reviewStats: DoctorReviewStats = { average: 0, count: 0 };
  let recentReviews: DoctorReview[] = [];
  try {
    [reviewStats, recentReviews] = await Promise.all([
      getDoctorReviewStats(),
      getDoctorReviews(3),
    ]);
  } catch (error) {
    console.error("Failed to load doctor reviews:", error);
  }

  return (
    <DoctorDashboardClient
      stats={stats}
      reviewStats={reviewStats}
      recentReviews={recentReviews}
    />
  );
}
