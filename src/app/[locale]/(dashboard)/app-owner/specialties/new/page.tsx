import { requireAppOwner } from "@/lib/app-owner-auth";
import { SpecialtyEditor } from "@/components/app-owner/specialty-editor";

import { getTranslations } from "next-intl/server";

export default async function NewSpecialtyPage() {
  await requireAppOwner();
  const t = await getTranslations("appOwner.specialties");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("newSpecialtyTitle")}</h2>
        <p className="text-muted-foreground">
          {t("newSpecialtySubtitle")}
        </p>
      </div>
      <SpecialtyEditor />
    </div>
  );
}
