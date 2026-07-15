import { requireAppOwner } from "@/lib/app-owner-auth";
import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { getActiveSpecialties } from "@/app/actions/specialties";
import { TenantCreateForm } from "@/components/app-owner/tenant-create-form";
import type { PlanOption } from "@/types/tenant-creation.types";

import { getTranslations } from "next-intl/server";

export default async function NewTenantPage() {
  await requireAppOwner();
  const t = await getTranslations("appOwner.tenants");

  const [plans, specialties] = await Promise.all([
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
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("newTenantTitle")}</h2>
        <p className="text-muted-foreground">
          {t("newTenantSubtitle")}
        </p>
      </div>
      <TenantCreateForm plans={planOptions} specialties={specialties} />
    </div>
  );
}
