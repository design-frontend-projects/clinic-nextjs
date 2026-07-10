import { useLocale, useTranslations } from "next-intl";
import type { PublicStats } from "@/lib/public-data";

type StatsSectionProps = {
  stats: PublicStats;
};

export function StatsSection({ stats }: StatsSectionProps) {
  const t = useTranslations("landing.stats");
  const locale = useLocale();
  const formatter = new Intl.NumberFormat(locale);

  const items = [
    { label: t("doctors"), value: stats.doctors },
    { label: t("clinics"), value: stats.clinics },
    { label: t("specialties"), value: stats.specialties },
    { label: t("patients"), value: stats.patients },
  ];

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <p className="text-center text-eyebrow font-medium text-muted-foreground">
        {t("eyebrow")}
      </p>
      <h2 className="mx-auto mt-3 max-w-2xl text-center text-display-md text-foreground">
        {t("title")}
      </h2>
      <div className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-hairline bg-card p-6 text-center"
          >
            <p className="text-display-md text-foreground">
              {formatter.format(item.value)}
              <span className="text-fin">+</span>
            </p>
            <p className="mt-2 text-sm text-muted-foreground">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
