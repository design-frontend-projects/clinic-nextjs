import {
  Activity,
  BarChart3,
  CalendarDays,
  Receipt,
  Stethoscope,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: CalendarDays,
    titleKey: "appointmentManagement",
    descKey: "appointmentDesc",
    stickerBg: "bg-sticker-sky/15 text-primary dark:bg-surface-elevated dark:text-primary",
  },
  {
    icon: Users,
    titleKey: "patientRecords",
    descKey: "patientDesc",
    stickerBg: "bg-sticker-purple/30 text-[#391c57] dark:bg-surface-elevated dark:text-primary",
  },
  {
    icon: Stethoscope,
    titleKey: "staffManagement",
    descKey: "staffDesc",
    stickerBg: "bg-sticker-teal/15 text-sticker-teal dark:bg-surface-elevated dark:text-primary",
  },
  {
    icon: Receipt,
    titleKey: "billing",
    descKey: "billingDesc",
    stickerBg: "bg-sticker-orange/15 text-sticker-orange dark:bg-surface-elevated dark:text-primary",
  },
  {
    icon: BarChart3,
    titleKey: "analytics",
    descKey: "analyticsDesc",
    stickerBg: "bg-sticker-green/15 text-sticker-green dark:bg-surface-elevated dark:text-primary",
  },
  {
    icon: Activity,
    titleKey: "pharmacy",
    descKey: "pharmacyDesc",
    stickerBg: "bg-sticker-pink/20 text-[#9b1c6d] dark:bg-surface-elevated dark:text-primary",
  },
] as const;

export function FeaturesSection() {
  const t = useTranslations("landing.features");

  return (
    <section id="features" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:py-20">
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
            className="nvidia-corner-accent rounded-[var(--radius-card)] border border-hairline bg-card p-6 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-[var(--radius-button)]",
                feature.stickerBg,
              )}
            >
              <feature.icon className="h-5 w-5" />
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
