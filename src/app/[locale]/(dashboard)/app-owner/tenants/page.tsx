import { Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTenants } from "@/app/actions/app-owner/tenants";
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
import { TenantRowActions } from "@/components/app-owner/tenant-row-actions";

import { getTranslations } from "next-intl/server";

export default async function TenantsPage() {
  const tenants = await getTenants();
  const t = await getTranslations("appOwner.tenants");

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button asChild>
          <Link href="/app-owner/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            {t("createTenant")}
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.clinicName")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead>{t("table.subscription")}</TableHead>
              <TableHead>{t("table.users")}</TableHead>
              <TableHead>{t("table.patients")}</TableHead>
              <TableHead>{t("table.created")}</TableHead>
              <TableHead className="text-right">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id}>
                <TableCell className="font-medium">{tenant.name}</TableCell>
                <TableCell>
                  <Badge variant={tenant.status === "active" ? "default" : "secondary"}>
                    {tenant.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {tenant.tenant_subscription?.plan ? (
                    <Badge variant="outline">{tenant.tenant_subscription.plan.name}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">{t("noActivePlan")}</span>
                  )}
                </TableCell>
                <TableCell>{tenant._count.staff_profiles}</TableCell>
                <TableCell>{tenant._count.patients}</TableCell>
                <TableCell>{new Date(tenant.created_at).toLocaleDateString()}</TableCell>
                <TableCell className="text-right">
                  <TenantRowActions
                    tenant={{
                      id: tenant.id,
                      name: tenant.name,
                      status: tenant.status,
                    }}
                    owner={
                      tenant.staff_profiles[0]
                        ? {
                            id: tenant.staff_profiles[0].id,
                            full_name: tenant.staff_profiles[0].full_name,
                            email: tenant.staff_profiles[0].email,
                            status: tenant.staff_profiles[0].status,
                          }
                        : null
                    }
                  />
                </TableCell>
              </TableRow>
            ))}
            {tenants.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center h-24 text-muted-foreground">
                  {t("noTenants")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
