import { requireAppOwner } from "@/lib/app-owner-auth";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { SpecialtyEditor } from "@/components/app-owner/specialty-editor";

import { getTranslations } from "next-intl/server";

export default async function NewSpecialtyPage() {
  await requireAppOwner();
  const [t, tCommon] = await Promise.all([
    getTranslations("appOwner.specialties"),
    getTranslations("appOwner.common"),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AppOwnerPageHeader
        backHref="/app-owner/specialties"
        backLabel={tCommon("backToList")}
        title={t("newSpecialtyTitle")}
        description={t("newSpecialtySubtitle")}
      />
      <SpecialtyEditor />
    </div>
  );
}
