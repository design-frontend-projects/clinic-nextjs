"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GeneralSettingsTab } from "./GeneralSettingsTab";
import { LocalizationTab } from "./LocalizationTab";
import { BrandingTab } from "./BrandingTab";
import { WorkingHoursTab } from "./WorkingHoursTab";
import { AppointmentsTab } from "./AppointmentsTab";
import { NotificationsTab } from "./NotificationsTab";
import { FeatureFlagsTab } from "./FeatureFlagsTab";
import { LookupsTab } from "./LookupsTab";
import { DocumentNumberingTab } from "./DocumentNumberingTab";
import { HistoryTab } from "./HistoryTab";
import { ImportExportControls } from "./ImportExportControls";

const TABS = [
  { value: "general", labelKey: "tabs.general", content: <GeneralSettingsTab /> },
  { value: "localization", labelKey: "tabs.localization", content: <LocalizationTab /> },
  { value: "branding", labelKey: "tabs.branding", content: <BrandingTab /> },
  { value: "working-hours", labelKey: "tabs.workingHours", content: <WorkingHoursTab /> },
  { value: "appointments", labelKey: "tabs.appointments", content: <AppointmentsTab /> },
  { value: "notifications", labelKey: "tabs.notifications", content: <NotificationsTab /> },
  { value: "features", labelKey: "tabs.features", content: <FeatureFlagsTab /> },
  { value: "lookups", labelKey: "tabs.lookups", content: <LookupsTab /> },
  { value: "numbering", labelKey: "tabs.numbering", content: <DocumentNumberingTab /> },
  { value: "history", labelKey: "tabs.history", content: <HistoryTab /> },
] as const;

export function TenantSettingsTabs() {
  const t = useTranslations("settings");

  return (
    <Tabs defaultValue="general" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="overflow-x-auto">
          <TabsList className="h-auto flex-wrap">
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <ImportExportControls />
      </div>
      {TABS.map((tab) => (
        <TabsContent key={tab.value} value={tab.value}>
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
