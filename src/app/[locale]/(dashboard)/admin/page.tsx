"use client";

import { useQuery } from "@tanstack/react-query";
import { getDashboardStats } from "@/app/actions/admin";
import { AdminDashboardClient } from "./_components/admin-dashboard-client";

const defaultStats = {
  totalPatients: 0,
  totalDoctors: 0,
  todayAppointments: 0,
  totalAppointments: 0,
  pendingPayments: 0,
  totalInsurances: 0,
  recentAppointments: [],
};

export default function AdminDashboard() {
  const { data: stats = defaultStats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
  });

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return <AdminDashboardClient stats={stats} />;
}
