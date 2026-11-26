import { requireAppOwner } from "@/lib/app-owner-auth";
import { getManagedClinics } from "@/app/actions/app-owner/medications";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import { MedicationEditor } from "@/components/app-owner/medication-editor";
import { getTranslations } from "next-intl/server";

interface NewMedicationPageProps {
  searchParams: Promise<{ clinic?: string }>;
}

export default async function NewMedicationPage({
  searchParams,
}: NewMedicationPageProps) {
  await requireAppOwner();
  const [{ clinic }, clinics, t, tCommon] = await Promise.all([
    searchParams,
    getManagedClinics(),
    getTranslations("appOwner.medications"),
    getTranslations("appOwner.common"),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <AppOwnerPageHeader
        backHref={`/app-owner/medications?clinic=${clinic ?? ""}`}
        backLabel={tCommon("backToList")}
        title={t("newMedication")}
      />
      <MedicationEditor clinics={clinics} defaultClinicId={clinic} />
    </div>
  );
}
