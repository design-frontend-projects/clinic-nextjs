"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, CreditCard, Lock, LogOut, XCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/i18n/routing";
import { performClientSignOut } from "@/lib/client-sign-out";
import type { TenantAccessDenied } from "@/lib/tenant-access";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface TenantAccessBlockedProps {
  access: TenantAccessDenied;
}

export function TenantAccessBlocked({ access }: TenantAccessBlockedProps) {
  const t = useTranslations("dashboard.accessBlocked");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await performClientSignOut(queryClient);
      router.replace("/sign-in");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  };

  const formattedStartDate = access.startDate
    ? new Date(access.startDate).toLocaleDateString()
    : "";
  const formattedEndDate = access.endDate
    ? new Date(access.endDate).toLocaleDateString()
    : "";

  const Icon =
    access.code === "under_review"
      ? Clock
      : access.code === "rejected"
        ? XCircle
        : access.code === "payment_pending" || access.code === "payment_refunded"
          ? CreditCard
          : access.code === "subscription_expired" ||
              access.code === "subscription_not_started"
            ? AlertTriangle
            : Lock;

  const description = (() => {
    switch (access.code) {
      case "under_review":
        return t("descriptions.under_review", {
          ref: access.requestRef || "—",
        });
      case "rejected":
        return access.reason
          ? t("descriptions.rejectedWithReason", {
              ref: access.requestRef || "—",
              reason: access.reason,
            })
          : t("descriptions.rejected", { ref: access.requestRef || "—" });
      case "subscription_not_started":
        return t("descriptions.subscription_not_started", {
          date: formattedStartDate,
        });
      case "subscription_expired":
        return t("descriptions.subscription_expired", {
          date: formattedEndDate,
        });
      case "suspended":
      case "account_blocked":
      case "account_inactive":
      case "no_subscription":
      case "subscription_suspended":
      case "subscription_cancelled":
      case "payment_pending":
      case "payment_refunded":
        return t(`descriptions.${access.code}`);
    }
  })();

  return (
    <div className="flex min-h-[65vh] items-center justify-center p-6">
      <Card className="w-full max-w-lg text-center">
        <CardHeader className="items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Icon className="h-6 w-6" />
          </span>
          <CardTitle>{t(`titles.${access.code}`)}</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {access.requestRef && (
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs font-mono">
              <span className="text-muted-foreground">{t("refLabel")}:</span>
              <span className="font-semibold text-foreground">
                {access.requestRef}
              </span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-wrap justify-center gap-3">
          {(access.code === "under_review" || access.code === "rejected") && (
            <Button asChild variant="outline">
              <Link
                href={
                  access.requestRef
                    ? `/request-status?ref=${encodeURIComponent(access.requestRef)}`
                    : "/request-status"
                }
              >
                {t("trackStatus")}
              </Link>
            </Button>
          )}
          <Button
            variant="default"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="me-2 h-4 w-4" />
            {t("signOut")}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
