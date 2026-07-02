import React from "react";
import { SubscriptionGuard } from "@/components/auth/SubscriptionGuard";

export default function BillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SubscriptionGuard plan="pro">
      {children}
    </SubscriptionGuard>
  );
}
