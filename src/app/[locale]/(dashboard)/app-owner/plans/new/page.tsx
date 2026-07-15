import { requireAppOwner } from "@/lib/app-owner-auth";
import { PlanEditor } from "@/components/app-owner/plan-editor";

import { getTranslations } from "next-intl/server";

export default async function NewPlanPage() {
  await requireAppOwner();
  const t = await getTranslations("appOwner.plans");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("newPlanTitle")}</h2>
        <p className="text-muted-foreground">{t("newPlanSubtitle")}</p>
      </div>
      <PlanEditor />
    </div>
  );
}
