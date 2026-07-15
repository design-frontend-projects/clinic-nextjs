import { notFound } from "next/navigation";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { getSpecialty } from "@/app/actions/app-owner/specialties";
import { SpecialtyEditor } from "@/components/app-owner/specialty-editor";
import type { SpecialtyFormData } from "@/types/specialty.types";

import { getTranslations } from "next-intl/server";

export default async function EditSpecialtyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAppOwner();
  const { id } = await params;
  const t = await getTranslations("appOwner.specialties");

  const specialty = await getSpecialty(id);
  if (!specialty) notFound();

  const initial: Partial<SpecialtyFormData> & { id: string } = {
    id: specialty.id,
    name: specialty.name,
    name_ar: specialty.name_ar,
    description: specialty.description,
    is_active: specialty.is_active,
    display_order: specialty.display_order,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("editSpecialtyTitle")}</h2>
        <p className="text-muted-foreground">{specialty.name}</p>
      </div>
      <SpecialtyEditor specialty={initial} />
    </div>
  );
}
