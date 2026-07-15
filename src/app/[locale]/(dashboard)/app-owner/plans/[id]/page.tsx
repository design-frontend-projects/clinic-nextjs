import { notFound } from "next/navigation";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { getSubscriptionPlan } from "@/app/actions/app-owner/plans";
import { PlanEditor } from "@/components/app-owner/plan-editor";
import type { SubscriptionPlanFormData } from "@/types/subscription.types";

import { getTranslations } from "next-intl/server";

export default async function EditPlanPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppOwner();
  const { id } = await params;
  const t = await getTranslations("appOwner.plans");

  const plan = await getSubscriptionPlan(id);
  if (!plan) notFound();

  const initial: Partial<SubscriptionPlanFormData> & { id: string } = {
    id: plan.id,
    name: plan.name,
    description: plan.description,
    billing_period: plan.billing_period,
    trial_days: plan.trial_days,
    price: Number(plan.price),
    currency: plan.currency,
    max_users: plan.max_users,
    max_doctors: plan.max_doctors,
    max_branches: plan.max_branches,
    max_patients: plan.max_patients,
    max_appointments: plan.max_appointments,
    max_storage_mb: plan.max_storage_mb,
    api_limits: plan.api_limits,
    status: plan.status,
    display_order: plan.display_order,
    public_notes: plan.public_notes,
    internal_notes: plan.internal_notes,
    features: plan.features.map((f) => ({
      feature_name: f.feature_name,
      is_enabled: f.is_enabled,
    })),
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("editPlanTitle")}</h2>
        <p className="text-muted-foreground">{plan.name}</p>
      </div>
      <PlanEditor plan={initial} />
    </div>
  );
}
