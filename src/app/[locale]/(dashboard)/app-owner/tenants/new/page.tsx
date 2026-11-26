import { requireAppOwner } from "@/lib/app-owner-auth";
import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { getActiveSpecialties } from "@/app/actions/specialties";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { TenantCreateForm } from "@/components/app-owner/tenant-create-form";
import type { PlanOption } from "@/types/tenant-creation.types";

import { getTranslations } from "next-intl/server";

export default async function NewTenantPage() {
  await requireAppOwner();
  const [t, tCommon, plans, specialties] = await Promise.all([
    getTranslations("appOwner.tenants"),
    getTranslations("appOwner.common"),
    getSubscriptionPlans(),
    getActiveSpecialties(),
  ]);

  // Slim, serializable plan options (Prisma Decimal doesn't cross to clients).
  const planOptions: PlanOption[] = plans
    .filter((plan) => plan.status === "active" && !plan.deleted_at)
    .map((plan) => ({
      id: plan.id,
      name: plan.name,
      price: Number(plan.price),
      currency: plan.currency,
      billing_period: plan.billing_period,
    }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AppOwnerPageHeader
        backHref="/app-owner/tenants"
        backLabel={tCommon("backToList")}
        title={t("newTenantTitle")}
        description={t("newTenantSubtitle")}
      />
      <TenantCreateForm plans={planOptions} specialties={specialties} />
    </div>
  );
}
