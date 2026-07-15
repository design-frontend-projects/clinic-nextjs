import { notFound } from "next/navigation";
import { requireAppOwner } from "@/lib/app-owner-auth";
import {
  getManagedClinics,
  getMedication,
} from "@/app/actions/app-owner/medications";
import { MedicationEditor } from "@/components/app-owner/medication-editor";
import type { MedicationFormData } from "@/types/medication.types";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

interface EditMedicationPageProps {
  params: Promise<{ id: string }>;
}

import { getTranslations } from "next-intl/server";

export default async function EditMedicationPage({
  params,
}: EditMedicationPageProps) {
  await requireAppOwner();
  const { id } = await params;
  const t = await getTranslations("appOwner.medications");

  const medication = await getMedication(id);
  if (!medication) {
    notFound();
  }

  const clinics = await getManagedClinics();

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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/app-owner/medications?clinic=${medication.clinic_id}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">{t("editMedication")}</h2>
      </div>
      <MedicationEditor clinics={clinics} medication={initial} />
    </div>
  );
}
