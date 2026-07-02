import { getGlobalSettings } from "@/app/actions/app-owner/settings";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTranslations } from "next-intl/server";

export default async function SettingsPage() {
  const t = await getTranslations("appOwner.settings");
  const settingsCategories = await getGlobalSettings();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-6">
        {Object.keys(settingsCategories).length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              {t("empty")}
            </CardContent>
          </Card>
        ) : (
          Object.keys(settingsCategories).map((category) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle className="capitalize">
                  {category.replace(/_/g, " ")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {settingsCategories[category].map((setting: any) => (
                  <div
                    key={setting.key}
                    className="flex justify-between items-center border-b pb-4 last:border-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">{setting.key}</p>
                      {setting.description && (
                        <p className="text-sm text-muted-foreground">
                          {setting.description}
                        </p>
                      )}
                    </div>
                    <div className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {JSON.stringify(setting.value)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
