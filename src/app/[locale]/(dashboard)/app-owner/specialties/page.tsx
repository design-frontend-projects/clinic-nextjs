import { getSpecialties } from "@/app/actions/app-owner/specialties";
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
import { Plus, Edit2 } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

export default async function SpecialtiesPage() {
  const t = await getTranslations("appOwner.specialties");
  const specialties = await getSpecialties();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button asChild>
          <Link href="/app-owner/specialties/new">
            <Plus className="h-4 w-4 mr-2" />
            {t("newButton")}
          </Link>
        </Button>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("name")}</TableHead>
              <TableHead>{t("nameAr")}</TableHead>
              <TableHead>{t("order")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("doctors")}</TableHead>
              <TableHead className="text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {specialties.map((specialty) => (
              <TableRow key={specialty.id}>
                <TableCell className="font-medium">{specialty.name}</TableCell>
                <TableCell dir="rtl">{specialty.name_ar || "-"}</TableCell>
                <TableCell>{specialty.display_order}</TableCell>
                <TableCell>
                  <Badge
                    variant={specialty.is_active ? "default" : "secondary"}
                  >
                    {specialty.is_active ? t("active") : t("inactive")}
                  </Badge>
                </TableCell>
                <TableCell>{specialty._count?.doctor_specialties ?? 0}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" asChild>
                    <Link href={`/app-owner/specialties/${specialty.id}`}>
                      <Edit2 className="h-4 w-4" />
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {specialties.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
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
