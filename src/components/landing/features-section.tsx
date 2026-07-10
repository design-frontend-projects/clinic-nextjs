import {
  Activity,
  BarChart3,
  CalendarDays,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";

const FEATURES = [
  { icon: CalendarDays, titleKey: "appointmentManagement", descKey: "appointmentDesc" },
  { icon: Users, titleKey: "patientRecords", descKey: "patientDesc" },
  { icon: Stethoscope, titleKey: "staffManagement", descKey: "staffDesc" },
  { icon: Receipt, titleKey: "billing", descKey: "billingDesc" },
  { icon: BarChart3, titleKey: "analytics", descKey: "analyticsDesc" },
  { icon: Activity, titleKey: "pharmacy", descKey: "pharmacyDesc" },
] as const;

export function FeaturesSection() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <h2 className="mx-auto max-w-2xl text-center text-display-md text-foreground">
        {t("title")}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-subhead text-muted-foreground">
        {t("subtitle")}
      </p>
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.titleKey}
            className="rounded-lg border border-hairline bg-card p-6"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <feature.icon className="h-5 w-5 text-foreground" />
            </div>
            <h3 className="mt-4 text-card-title text-foreground">
              {t(feature.titleKey)}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t(feature.descKey)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
