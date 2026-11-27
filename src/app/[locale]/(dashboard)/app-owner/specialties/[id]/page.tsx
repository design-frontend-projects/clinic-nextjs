import { notFound } from "next/navigation";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { getSpecialty } from "@/app/actions/app-owner/specialties";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { SpecialtyEditor } from "@/components/app-owner/specialty-editor";
import type { SpecialtyFormData } from "@/types/specialty.types";
import type { DiagramKey } from "@/types/body-chart.types";
import { isDiagramKey } from "@/lib/body-chart/registry";

import { getTranslations } from "next-intl/server";

export default async function EditSpecialtyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppOwner();
  const { id } = await params;
  const [t, tCommon, specialty] = await Promise.all([
    getTranslations("appOwner.specialties"),
    getTranslations("appOwner.common"),
    getSpecialty(id),
  ]);

  if (!specialty) notFound();

  const initial: Partial<SpecialtyFormData> & { id: string } = {
    id: specialty.id,
    name: specialty.name,
    name_ar: specialty.name_ar,
    description: specialty.description,
    diagram_key: isDiagramKey(specialty.diagram_key)
      ? (specialty.diagram_key as DiagramKey)
      : "general_body",
    is_active: specialty.is_active,
    display_order: specialty.display_order,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <AppOwnerPageHeader
        backHref="/app-owner/specialties"
        backLabel={tCommon("backToList")}
        title={t("editSpecialtyTitle")}
        description={specialty.name}
      />
      <SpecialtyEditor specialty={initial} />
    </div>
  );
}
