import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import {
  AppOwnerDashboardClient,
  type DashboardPendingTenant,
  type DashboardPlanAdoption,
} from "@/components/app-owner/dashboard-client";

export default async function AppOwnerDashboard() {
  await requireAppOwner();

  const [
    totalTenants,
    pendingRequests,
    activeTenants,
    suspendedOrRejected,
    totalUsers,
    activeSubscriptions,
    plansCount,
    pendingClinics,
    plansWithCounts,
  ] = await Promise.all([
    prisma.clinics.count(),
    prisma.clinics.count({ where: { status: "under_review" } }),
    prisma.clinics.count({ where: { status: { in: ["active", "trial"] } } }),
    prisma.clinics.count({
      where: { status: { in: ["suspended", "rejected"] } },
    }),
    prisma.profiles.count(),
    prisma.tenant_subscriptions.count({ where: { status: "active" } }),
    prisma.subscription_plans.count({ where: { status: "active" } }),
    prisma.clinics.findMany({
      where: { status: "under_review" },
      include: {
        staff_profiles: {
          where: { role: "owner" },
          take: 1,
          select: {
            auth_user_id: true,
            full_name: true,
            email: true,
            phone: true,
          },
        },
      },
      orderBy: { created_at: "desc" },
      take: 5,
    }),
    prisma.subscription_plans.findMany({
      where: { deleted_at: null, status: "active" },
      select: {
        id: true,
        name: true,
        _count: {
          select: {
            tenant_subscriptions: {
              where: { status: { not: "cancelled" } },
            },
          },
        },
      },
      orderBy: { display_order: "asc" },
    }),
  ]);

  const pendingOwnerAuthIds = Array.from(
    new Set(
      pendingClinics
        .map((c) => c.auth_user_id ?? c.staff_profiles[0]?.auth_user_id ?? null)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const pendingSubs =
    pendingOwnerAuthIds.length > 0
      ? await prisma.tenant_subscriptions.findMany({
          where: { tenant_id: { in: pendingOwnerAuthIds } },
          include: { plan: { select: { id: true, name: true } } },
        })
      : [];

  const subByOwnerAuthId = new Map(pendingSubs.map((s) => [s.tenant_id, s]));

  const pendingQueue: DashboardPendingTenant[] = pendingClinics.map((clinic) => {
    const ownerProfile = clinic.staff_profiles[0] ?? null;
    const ownerAuthId = clinic.auth_user_id ?? ownerProfile?.auth_user_id ?? null;
    const sub = ownerAuthId ? (subByOwnerAuthId.get(ownerAuthId) ?? null) : null;

    return {
      id: clinic.id,
      name: clinic.name,
      status: clinic.status,
      request_ref: clinic.request_ref,
      created_at: clinic.created_at.toISOString(),
      email: clinic.email,
      phone: clinic.phone,
      owner: ownerProfile
        ? {
            full_name: ownerProfile.full_name,
            email: ownerProfile.email,
            phone: ownerProfile.phone,
          }
        : null,
      initialSubscription: sub
        ? {
            plan_id: sub.plan_id,
            plan_name: sub.plan?.name ?? null,
            billing_cycle: sub.billing_cycle,
            price: Number(sub.price),
            currency: sub.currency,
            grace_period_days: sub.grace_period_days,
          }
        : null,
    };
  });

  const planAdoption: DashboardPlanAdoption[] = plansWithCounts.map((p) => ({
    id: p.id,
    name: p.name,
    subscribers: p._count.tenant_subscriptions,
  }));

  return (
    <AppOwnerDashboardClient
      metrics={{
        totalTenants,
        pendingRequests,
        activeTenants,
        suspendedOrRejected,
        totalUsers,
        activeSubscriptions,
        plansCount,
      }}
      pendingQueue={pendingQueue}
      planAdoption={planAdoption}
    />
  );
}
