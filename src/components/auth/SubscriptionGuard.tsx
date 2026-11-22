import React from "react";
import { hasSubscription } from "@/lib/subscription";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";

type SubscriptionPlan = "free" | "pro" | "enterprise";

interface SubscriptionGuardProps {
  plan: SubscriptionPlan;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showPaywall?: boolean;
}

/**
 * A Server Component that conditionally renders its children based on
 * whether the current tenant has the required subscription plan.
 */
export async function SubscriptionGuard({
  plan,
  children,
  fallback = null,
  showPaywall = true,
}: SubscriptionGuardProps) {
  const hasAccess = await hasSubscription(plan);

  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showPaywall) {
      const t = await getTranslations("subscriptionGuard");
      return (
        <Card className="w-full max-w-md mx-auto mt-8 border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {t("description", { plan: plan.toUpperCase() })}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              {t("body")}
            </p>
            {/* TODO: Add link to billing/upgrade page */}
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}
