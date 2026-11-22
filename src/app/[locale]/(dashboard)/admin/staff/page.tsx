"use client";

import { useTranslations } from "next-intl";
import { PersonnelManagement } from "@/components/admin/personnel-management";
import { Heading } from "@/components/ui/heading";
import { Separator } from "@/components/ui/separator";

export default function StaffPage() {
  const t = useTranslations("admin.staff");
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-start justify-between">
        <Heading
          title={t("title")}
          description={t("description")}
        />
      </div>
      <Separator />
      <PersonnelManagement role="staff" title={t("singular")} />
    </div>
  );
}
