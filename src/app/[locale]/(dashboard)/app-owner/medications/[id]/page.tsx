import { notFound } from "next/navigation";
import { requireAppOwner } from "@/lib/app-owner-auth";
import {
  getManagedClinics,
  getMedication,
} from "@/app/actions/app-owner/medications";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { MedicationEditor } from "@/components/app-owner/medication-editor";
import type { MedicationFormData } from "@/types/medication.types";
import { getTranslations } from "next-intl/server";

interface EditMedicationPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditMedicationPage({
  params,
}: EditMedicationPageProps) {
  await requireAppOwner();
  const { id } = await params;
  const [t, tCommon, medication, clinics] = await Promise.all([
    getTranslations("appOwner.medications"),
    getTranslations("appOwner.common"),
    getMedication(id),
    getManagedClinics(),
  ]);

  if (!medication) {
    notFound();
  }

  const initial: Partial<MedicationFormData> & { id: string } = {
    id: medication.id,
    clinic_id: medication.clinic_id,
    generic_name: medication.generic_name,
    brand_name: medication.brand_name,
    strength: medication.strength,
    form: medication.form,
    route: medication.route,
    manufacturer: medication.manufacturer,
    barcode: medication.barcode,
    code: medication.code,
    code_system: medication.code_system,
    price: medication.price != null ? Number(medication.price) : null,
    is_active: medication.is_active,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AppOwnerPageHeader
        backHref={`/app-owner/medications?clinic=${medication.clinic_id}`}
        backLabel={tCommon("backToList")}
        title={t("editMedication")}
        description={medication.generic_name}
      />
      <MedicationEditor clinics={clinics} medication={initial} />
    </div>
  );
}
