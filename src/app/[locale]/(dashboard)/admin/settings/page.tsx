import { getTranslations } from "next-intl/server";
import { Settings } from "lucide-react";
import { TenantSettingsTabs } from "@/features/settings/components/TenantSettingsTabs";

export default async function SettingsPage() {
  const t = await getTranslations("settings");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
          <Settings className="size-7" />
          {t("title")}
        </h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TenantSettingsTabs />
    </div>
  );
}
