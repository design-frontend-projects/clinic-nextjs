import { getTranslations } from "next-intl/server";
import { SlidersHorizontal } from "lucide-react";
import { UserPreferencesForm } from "@/features/settings/components/UserPreferencesForm";

export default async function PreferencesPage() {
  const t = await getTranslations("settings.preferences");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <SlidersHorizontal className="size-7" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <UserPreferencesForm />
    </div>
  );
}
