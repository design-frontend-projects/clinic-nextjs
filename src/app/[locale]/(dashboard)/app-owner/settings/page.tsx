import { getTranslations } from "next-intl/server";
import { requireAppOwner } from "@/lib/app-owner-auth";
import { PlatformSettingsManager } from "@/components/app-owner/settings/PlatformSettingsManager";

export default async function SettingsPage() {
  await requireAppOwner();
  const t = await getTranslations("appOwner.settings");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
        <p className="text-muted-foreground">{t("subtitle")}</p>
      </div>
      <PlatformSettingsManager />
    </div>
  );
}
