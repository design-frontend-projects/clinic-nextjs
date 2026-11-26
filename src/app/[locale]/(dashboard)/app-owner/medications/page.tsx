import {
  getManagedClinics,
  getMedications,
} from "@/app/actions/app-owner/medications";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { AppOwnerPageHeader } from "@/components/app-owner/app-owner-page-header";
import {
  MedicationsView,
  type SerializedMedication,
} from "@/components/app-owner/medications-view";

interface MedicationsPageProps {
  searchParams: Promise<{ clinic?: string }>;
}

export default async function MedicationsPage({
  searchParams,
}: MedicationsPageProps) {
  await requireAppOwner();
  const t = await getTranslations("appOwner.medications");

  const clinics = await getManagedClinics();

  if (clinics.length === 0) {
    return (
      <div className="space-y-6">
        <AppOwnerPageHeader title={t("title")} description={t("subtitle")} />
        <Card elevated className="p-8 text-center text-muted-foreground">
          {t("noClinics")}
        </Card>
      </div>
    );
  }

  const { clinic } = await searchParams;
  const selectedClinicId =
    clinic && clinics.some((c) => c.id === clinic) ? clinic : clinics[0].id;
  const medications = await getMedications(selectedClinicId);

  const serializedMedications: SerializedMedication[] = medications.map((m) => ({
    id: m.id,
    generic_name: m.generic_name,
    brand_name: m.brand_name,
    strength: m.strength,
    form: m.form,
    route: m.route,
    price: m.price != null ? Number(m.price) : null,
    is_active: m.is_active,
  }));

  return (
    <MedicationsView
      clinics={clinics}
      selectedClinicId={selectedClinicId}
      medications={serializedMedications}
    />
  );
}
