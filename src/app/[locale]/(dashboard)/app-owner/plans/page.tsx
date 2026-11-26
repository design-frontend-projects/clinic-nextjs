import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import {
  PlansView,
  type SerializedPlan,
} from "@/components/app-owner/plans-view";

export default async function PlansPage() {
  const plans = await getSubscriptionPlans();

  const serializedPlans: SerializedPlan[] = plans.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    price: Number(plan.price),
    currency: plan.currency,
    billing_period: plan.billing_period,
    trial_days: plan.trial_days,
    status: plan.status,
    max_users: plan.max_users,
    max_doctors: plan.max_doctors,
    max_branches: plan.max_branches,
    activeSubsCount: plan._count?.tenant_subscriptions ?? 0,
    features: plan.features.map((f) => ({
      id: f.id,
      feature_name: f.feature_name,
      is_enabled: f.is_enabled,
    })),
  }));

  return <PlansView plans={serializedPlans} />;
}
