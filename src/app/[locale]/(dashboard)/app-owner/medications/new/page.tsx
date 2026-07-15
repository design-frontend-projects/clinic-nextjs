import { requireAppOwner } from "@/lib/app-owner-auth";
import { getManagedClinics } from "@/app/actions/app-owner/medications";
import { MedicationEditor } from "@/components/app-owner/medication-editor";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/routing";

interface NewMedicationPageProps {
  searchParams: Promise<{ clinic?: string }>;
}

import { getTranslations } from "next-intl/server";

export default async function NewMedicationPage({
  searchParams,
}: NewMedicationPageProps) {
  await requireAppOwner();
  const { clinic } = await searchParams;
  const clinics = await getManagedClinics();
  const t = await getTranslations("appOwner.medications");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/app-owner/medications?clinic=${clinic ?? ""}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h2 className="text-2xl font-bold tracking-tight">{t("newMedication")}</h2>
      </div>
      <MedicationEditor clinics={clinics} defaultClinicId={clinic} />
    </div>
  );
}
