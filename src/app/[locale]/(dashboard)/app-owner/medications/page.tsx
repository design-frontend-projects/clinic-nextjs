import {
  getManagedClinics,
  getMedications,
} from "@/app/actions/app-owner/medications";
import { requireAppOwner } from "@/lib/app-owner-auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";
import { MedicationClinicSelector } from "@/components/app-owner/medication-clinic-selector";
import { MedicationRowActions } from "@/components/app-owner/medication-row-actions";

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
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="rounded-md border bg-card p-8 text-center text-muted-foreground">
          {t("noClinics")}
        </div>
      </div>
    );
  }

  const { clinic } = await searchParams;
  const selectedClinicId =
    clinic && clinics.some((c) => c.id === clinic) ? clinic : clinics[0].id;
  const medications = await getMedications(selectedClinicId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <MedicationClinicSelector
            clinics={clinics}
            value={selectedClinicId}
            label={t("clinic")}
          />
          <Button asChild>
            <Link href={`/app-owner/medications/new?clinic=${selectedClinicId}`}>
              <Plus className="h-4 w-4 mr-2" />
              {t("newButton")}
            </Link>
          </Button>
        </div>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("generic")}</TableHead>
              <TableHead>{t("brand")}</TableHead>
              <TableHead>{t("strength")}</TableHead>
              <TableHead>{t("form")}</TableHead>
              <TableHead>{t("price")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {medications.map((medication) => (
              <TableRow key={medication.id}>
                <TableCell className="font-medium">
                  {medication.generic_name}
                </TableCell>
                <TableCell>{medication.brand_name || "-"}</TableCell>
                <TableCell>{medication.strength || "-"}</TableCell>
                <TableCell>{medication.form || "-"}</TableCell>
                <TableCell>
                  {medication.price != null ? medication.price.toString() : "-"}
                </TableCell>
                <TableCell>
                  <Badge variant={medication.is_active ? "default" : "secondary"}>
                    {medication.is_active ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <MedicationRowActions
                    id={medication.id}
                    isActive={medication.is_active}
                    activateLabel={t("activate")}
                    deactivateLabel={t("deactivate")}
                  />
                </TableCell>
              </TableRow>
            ))}
            {medications.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center h-24 text-muted-foreground"
                >
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
