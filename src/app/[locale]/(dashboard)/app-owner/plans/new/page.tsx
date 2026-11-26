import { requireAppOwner } from "@/lib/app-owner-auth";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { PlanEditor } from "@/components/app-owner/plan-editor";

import { getTranslations } from "next-intl/server";

export default async function NewPlanPage() {
  await requireAppOwner();
  const [t, tCommon] = await Promise.all([
    getTranslations("appOwner.plans"),
    getTranslations("appOwner.common"),
  ]);

  return (
    <div className="space-y-6">
      <AppOwnerPageHeader
        backHref="/app-owner/plans"
        backLabel={tCommon("backToList")}
        title={t("newPlanTitle")}
        description={t("newPlanSubtitle")}
      />
      <PlanEditor />
    </div>
  );
}
