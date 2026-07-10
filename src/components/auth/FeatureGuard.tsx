import React from "react";
import { hasFeature } from "@/lib/features";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock } from "lucide-react";

interface FeatureGuardProps {
  /** Feature flag key, e.g. "pharmacy", "sms_reminders". */
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showPaywall?: boolean;
}

/**
 * Server Component that renders its children only when the feature flag is
 * enabled for the current tenant (kill switch > tenant override > plan
 * entitlement > default). Sibling of SubscriptionGuard, which gates by the
 * legacy plan-tier string — prefer this for new work.
 */
export async function FeatureGuard({
  feature,
  children,
  fallback = null,
  showPaywall = true,
}: FeatureGuardProps) {
  const enabled = await hasFeature(feature);

  if (!enabled) {
    if (fallback) {
      return <>{fallback}</>;
    }

    if (showPaywall) {
      return (
        <Card className="w-full max-w-md mx-auto mt-8 border-dashed">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Feature Not Available</CardTitle>
            <CardDescription>
              This feature is not included in your clinic&apos;s current plan.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade your subscription or contact support to enable it.
            </p>
          </CardContent>
        </Card>
      );
    }

    return null;
  }

  return <>{children}</>;
}
