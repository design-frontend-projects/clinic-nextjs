import { getSubscriptionPlans } from "@/app/actions/app-owner/plans";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, Edit2 } from "lucide-react";
import Link from "next/link";
import { getTranslations } from 'next-intl/server';

export default async function PlansPage() {
  const t = await getTranslations('appOwner.plans');
  const plans = await getSubscriptionPlans();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <Button asChild>
          <Link href="/app-owner/plans/new">
            <Plus className="h-4 w-4 mr-2" />
            {t('newButton')}
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plan Name</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Billing Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Active Subs</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency }).format(Number(plan.price))}
                </TableCell>
                <TableCell className="capitalize">{plan.billing_period.replace('_', ' ')}</TableCell>
                <TableCell>
                  <Badge variant={plan.status === "active" ? "default" : "secondary"}>
                    {plan.status}
                  </Badge>
                </TableCell>
                <TableCell>{plan._count?.tenant_subscriptions || 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/app-owner/plans/${plan.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {plans.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                  No subscription plans found. Create one to get started.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
