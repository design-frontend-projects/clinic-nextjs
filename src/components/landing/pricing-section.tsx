import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicPlan } from "@/types/subscription.types";

type PricingSectionProps = {
  plans: PublicPlan[];
};

type FallbackPlan = {
  nameKey: string;
  priceKey: string;
  periodKey?: string;
  descKey: string;
  featuresKey: string;
  popular?: boolean;
};

const FALLBACK_PLANS: FallbackPlan[] = [
  {
    nameKey: "starter",
    priceKey: "starterPrice",
    descKey: "starterDesc",
    featuresKey: "starterFeatures",
  },
  {
    nameKey: "professional",
    priceKey: "professionalPrice",
    periodKey: "professionalPeriod",
    descKey: "professionalDesc",
    featuresKey: "professionalFeatures",
    popular: true,
  },
  {
    nameKey: "enterprise",
    priceKey: "enterprisePrice",
    periodKey: "enterprisePeriod",
    descKey: "enterpriseDesc",
    featuresKey: "enterpriseFeatures",
  },
];

const PERIOD_KEY: Record<PublicPlan["billing_period"], string> = {
  monthly: "perMonth",
  quarterly: "perQuarter",
  semi_annual: "perSemiAnnual",
  annual: "perYear",
  lifetime: "lifetime",
};

function PlanCard({
  name,
  description,
  priceLabel,
  periodLabel,
  features,
  popular,
  href,
  labels,
}: {
  name: string;
  description: string | null;
  priceLabel: string;
  periodLabel: string | null;
  features: string[];
  popular: boolean;
  href: { pathname: string; query?: Record<string, string> } | string;
  labels: { popular: string; getStarted: string; trial: string | null };
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border p-6",
        popular
          ? "border-foreground bg-primary text-primary-foreground"
          : "border-hairline bg-card text-card-foreground",
      )}
    >
      {popular && (
        <span className="absolute -top-3 start-6 rounded-full bg-fin px-3 py-1 text-xs font-medium text-white">
          {labels.popular}
        </span>
      )}
      <h3 className="text-card-title">{name}</h3>
      {description && (
        <p className={cn("mt-1 text-sm", popular ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {description}
        </p>
      )}
      <p className="mt-5">
        <span className="text-display-md">{priceLabel}</span>
        {periodLabel && (
          <span className={cn("text-sm", popular ? "text-primary-foreground/70" : "text-muted-foreground")}>
            {periodLabel}
          </span>
        )}
      </p>
      {labels.trial && (
        <p className={cn("mt-1 text-xs", popular ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {labels.trial}
        </p>
      )}
      <ul className="mt-6 flex-1 space-y-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm">
            <Check
              className={cn(
                "mt-0.5 h-4 w-4 shrink-0",
                popular ? "text-primary-foreground" : "text-accent-green",
              )}
            />
            {feature}
          </li>
        ))}
      </ul>
      <Button
        asChild
        variant={popular ? "secondary" : "default"}
        className="mt-8 w-full"
      >
        <Link href={href}>{labels.getStarted}</Link>
      </Button>
    </div>
  );
}

export function PricingSection({ plans }: PricingSectionProps) {
  const t = useTranslations("landing.pricing");
  const tx = useTranslations("landing.pricingExtra");
  const locale = useLocale();

  const hasDbPlans = plans.length > 0;

  return (
    <section id="pricing" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <h2 className="mx-auto max-w-2xl text-center text-display-md text-foreground">
        {t("title")}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-subhead text-muted-foreground">
        {t("subtitle")}
      </p>
      <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {hasDbPlans
          ? plans.map((plan, index) => {
              const popular = plans.length >= 3 ? index === 1 : index === 0;
              const priceLabel =
                plan.price === 0
                  ? tx("free")
                  : new Intl.NumberFormat(locale, {
                      style: "currency",
                      currency: plan.currency || "USD",
                      maximumFractionDigits: plan.price % 1 === 0 ? 0 : 2,
                    }).format(plan.price);
              const features = [
                ...plan.features
                  .filter((f) => f.is_enabled)
                  .map((f) => f.feature_name),
                ...(plan.max_users ? [tx("maxUsers", { count: plan.max_users })] : []),
                ...(plan.max_doctors ? [tx("maxDoctors", { count: plan.max_doctors })] : []),
                ...(plan.max_branches ? [tx("maxBranches", { count: plan.max_branches })] : []),
              ];
              return (
                <PlanCard
                  key={plan.id}
                  name={plan.name}
                  description={plan.description ?? plan.public_notes}
                  priceLabel={priceLabel}
                  periodLabel={plan.price === 0 ? null : tx(PERIOD_KEY[plan.billing_period])}
                  features={features}
                  popular={popular}
                  href={{ pathname: "/sign-up", query: { plan: plan.id } }}
                  labels={{
                    popular: tx("popular"),
                    getStarted: tx("getStarted"),
                    trial:
                      plan.trial_days > 0
                        ? tx("freeTrial", { days: plan.trial_days })
                        : null,
                  }}
                />
              );
            })
          : FALLBACK_PLANS.map((plan) => (
              <PlanCard
                key={plan.nameKey}
                name={t(plan.nameKey)}
                description={t(plan.descKey)}
                priceLabel={t(plan.priceKey)}
                periodLabel={plan.periodKey ? t(plan.periodKey) : null}
                features={t.raw(plan.featuresKey) as string[]}
                popular={Boolean(plan.popular)}
                href="/sign-up"
                labels={{
                  popular: tx("popular"),
                  getStarted: tx("getStarted"),
                  trial: null,
                }}
              />
            ))}
      </div>
    </section>
  );
}
