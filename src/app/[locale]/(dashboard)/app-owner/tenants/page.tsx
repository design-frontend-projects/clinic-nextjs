import { getTenants } from "@/app/actions/app-owner/tenants";
import { requireAppOwner } from "@/lib/app-owner-auth";
import {
  TenantsView,
  type SerializedTenantRow,
  type TenantTabFilter,
} from "@/components/app-owner/tenants-view";

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAppOwner();
  const [{ tab: rawTab }, tenants] = await Promise.all([
    searchParams,
    getTenants(),
  ]);

  const activeTab: TenantTabFilter =
    rawTab === "requests" || rawTab === "active" || rawTab === "closed"
      ? rawTab
      : "all";

  const matchesTab = (status: string, tab: TenantTabFilter) => {
    if (tab === "requests") {
      return status === "under_review" || status === "rejected";
    }
    if (tab === "active") {
      return status === "active" || status === "trial";
    }
    if (tab === "closed") {
      return status === "suspended" || status === "rejected";
    }
    return true;
  };

  const tabCounts: Record<TenantTabFilter, number> = {
    all: tenants.length,
    requests: tenants.filter((t) => matchesTab(t.status, "requests")).length,
    active: tenants.filter((t) => matchesTab(t.status, "active")).length,
    closed: tenants.filter((t) => matchesTab(t.status, "closed")).length,
  };

  const filteredTenants: SerializedTenantRow[] = tenants
    .filter((item) => matchesTab(item.status, activeTab))
    .map((tenant) => {
      const sub = tenant.tenant_subscription;
      const owner = tenant.staff_profiles[0] ?? null;

      return {
        id: tenant.id,
        name: tenant.name,
        status: tenant.status,
        request_ref: tenant.request_ref,
        created_at: tenant.created_at.toISOString(),
        email: tenant.email,
        phone: tenant.phone,
        auth_user_id: tenant.auth_user_id,
        staffCount: tenant._count.staff_profiles,
        patientsCount: tenant._count.patients,
        owner: owner
          ? {
              id: owner.id,
              auth_user_id: owner.auth_user_id,
              full_name: owner.full_name,
              email: owner.email,
              phone: owner.phone,
              status: owner.status,
            }
          : null,
        subscription: sub
          ? {
              plan_id: sub.plan_id,
              plan_name: sub.plan?.name ?? null,
              billing_cycle: sub.billing_cycle,
              price: Number(sub.price),
              currency: sub.currency,
              status: sub.status,
              payment_status: sub.payment_status,
              payment_reference: sub.payment_reference,
              start_date: sub.start_date.toISOString(),
              end_date: sub.end_date?.toISOString() ?? null,
              grace_period_days: sub.grace_period_days,
            }
          : null,
      };
    });

  return (
    <TenantsView
      tenants={filteredTenants}
      activeTab={activeTab}
      tabCounts={tabCounts}
    />
  );
}
