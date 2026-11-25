import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/routing";
import { resolveDashboardTenant } from "@/lib/auth";
import { getClinicMedicines } from "@/app/actions/medicine";
import { MedicinesManagementClient } from "@/components/medicines/medicines-management-client";

export default async function AdminMedicinesPage() {
  const locale = await getLocale();
  const result = await resolveDashboardTenant();

  if (result.status !== "ok") {
    return redirect({ href: "/", locale });
  }

  const { role } = result.tenant;
  if (role !== "owner" && role !== "doctor") {
    const fallback =
      role === "admin" || role === "super_admin" ? "/admin" : "/";
    return redirect({ href: fallback, locale });
  }

  const medicinesRes = await getClinicMedicines();
  if ("error" in medicinesRes) {
    return redirect({ href: "/admin", locale });
  }

  return (
    <MedicinesManagementClient
      initialMedicines={medicinesRes.data.medicines}
      initialCounts={medicinesRes.data.counts}
    />
  );
}
