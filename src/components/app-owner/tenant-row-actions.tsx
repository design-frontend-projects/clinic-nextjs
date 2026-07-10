"use client";

import { useState, useTransition } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { MoreHorizontal, Loader2 } from "lucide-react";

import {
  suspendTenant,
  activateTenant,
  blockUser,
  unblockUser,
  emailUser,
  assignTenantPlan,
} from "@/app/actions/app-owner/tenants";
import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const BILLING_CYCLES = [
  "monthly",
  "quarterly",
  "semi_annual",
  "annual",
  "lifetime",
] as const;
const SUB_STATUSES = ["active", "past_due", "suspended", "cancelled"] as const;

type BillingCycle = (typeof BILLING_CYCLES)[number];
type SubStatus = (typeof SUB_STATUSES)[number];

interface TenantOwner {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
}

interface TenantRowActionsProps {
  tenant: { id: string; name: string; status: string };
  owner: TenantOwner | null;
}

export function TenantRowActions({ tenant, owner }: TenantRowActionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [planId, setPlanId] = useState<string>("");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [price, setPrice] = useState<string>("");
  const [subStatus, setSubStatus] = useState<SubStatus>("active");

  const { data: plans = [] } = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => getSubscriptionPlans(),
    enabled: open,
  });

  const run = (fn: () => Promise<{ error?: string; success?: boolean }>) => {
    startTransition(async () => {
      const result = await fn();
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Done.");
      router.refresh();
    });
  };

  const handleAssignPlan = () => {
    if (!planId) {
      toast.error("Select a plan first.");
      return;
    }
    run(() =>
      assignTenantPlan({
        tenant_id: tenant.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        price: Number(price || 0),
        status: subStatus,
        currency: "USD",
      }),
    );
  };

  const isSuspended = tenant.status === "suspended";
  const isOwnerBlocked = owner?.status === "blocked";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{tenant.name}</SheetTitle>
          <SheetDescription>
            Manage this tenant&apos;s status, owner, and subscription.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Tenant Status</h3>
            <p className="text-sm text-muted-foreground capitalize">
              Current: {tenant.status}
            </p>
            {isSuspended ? (
              <Button
                variant="outline"
                disabled={isPending}
                onClick={() => run(() => activateTenant(tenant.id))}
              >
                Activate Tenant
              </Button>
            ) : (
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() => run(() => suspendTenant(tenant.id))}
              >
                Suspend Tenant
              </Button>
            )}
          </section>

          <Separator />

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">Owner</h3>
            {owner ? (
              <>
                <p className="text-sm text-muted-foreground">
                  {owner.full_name || "—"} ({owner.email || "no email"}) —{" "}
                  <span className="capitalize">{owner.status}</span>
                </p>
                <div className="flex flex-wrap gap-2">
                  {isOwnerBlocked ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => unblockUser(owner.id))}
                    >
                      Unblock
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => run(() => blockUser(owner.id))}
                    >
                      Block
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isPending || !owner.email}
                    onClick={() => run(() => emailUser(owner.id))}
                  >
                    Email set-password link
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                No owner profile found for this tenant.
              </p>
            )}
          </section>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Assign / Change Plan</h3>
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Billing Cycle</Label>
                <Select
                  value={billingCycle}
                  onValueChange={(v) => setBillingCycle(v as BillingCycle)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLES.map((v) => (
                      <SelectItem key={v} value={v} className="capitalize">
                        {v.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Price</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={subStatus}
                onValueChange={(v) => setSubStatus(v as SubStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUB_STATUSES.map((v) => (
                    <SelectItem key={v} value={v} className="capitalize">
                      {v.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              className="w-full"
              disabled={isPending}
              onClick={handleAssignPlan}
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign Plan
            </Button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
