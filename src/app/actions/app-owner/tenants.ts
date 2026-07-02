"use server";

import { prisma } from "@/lib/prisma";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { revalidatePath } from "next/cache";

/**
 * Fetch all tenants (clinics) with their primary owner and subscription.
 */
export async function getTenants() {
  await requireAppOwner();

  return await prisma.clinics.findMany({
    include: {
      tenant_subscription: {
        include: {
          plan: true,
        },
      },
      staff_profiles: {
        where: { role: "owner" },
        take: 1,
      },
      _count: {
        select: { staff_profiles: true, patients: true },
      },
    },
    orderBy: { created_at: "desc" },
  });
}

/**
 * Suspend a tenant, blocking all of its users from accessing the application.
 */
export async function suspendTenant(tenantId: string) {
  const admin = await requireAppOwner();

  await prisma.clinics.update({
    where: { id: tenantId },
    data: { status: "suspended" as any }, 
  });

  // Log action
  await prisma.audit_logs.create({
    data: {
      tenant_id: tenantId,
      actor_id: admin.id,
      action: "TENANT_SUSPENDED",
      new_values: {},
    },
  });

  revalidatePath("/app-owner/tenants");
  return { success: true };
}

/**
 * Reactivate a suspended tenant.
 */
export async function activateTenant(tenantId: string) {
  const admin = await requireAppOwner();

  await prisma.clinics.update({
    where: { id: tenantId },
    data: { status: "active" as any },
  });

  await prisma.audit_logs.create({
    data: {
      tenant_id: tenantId,
      actor_id: admin.id,
      action: "TENANT_ACTIVATED",
      new_values: {},
    },
  });

  revalidatePath("/app-owner/tenants");
  return { success: true };
}
