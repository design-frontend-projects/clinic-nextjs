import { Stethoscope } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { PublicSpecialty } from "@/lib/public-data";

type SpecialtiesSectionProps = {
  specialties: PublicSpecialty[];
};

export function SpecialtiesSection({ specialties }: SpecialtiesSectionProps) {
  const t = useTranslations("landing.specialties");
  const locale = useLocale();

  if (specialties.length === 0) return null;

  return (
    <section id="specialties" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-center text-eyebrow font-semibold uppercase text-primary">
        {t("eyebrow")}
      </p>
      <h2 className="mx-auto mt-3 max-w-2xl text-center text-display-md text-foreground">
        {t("title")}
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-center text-subhead text-muted-foreground">
        {t("subtitle")}
      </p>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {specialties.map((specialty) => {
          const name =
            locale === "ar" && specialty.name_ar
              ? specialty.name_ar
              : specialty.name;
          return (
            <div
              key={specialty.id}
              className="flex items-start gap-3.5 rounded-[var(--radius-card)] border border-hairline bg-card p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-primary/40"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-badge)] bg-accent-blue-soft text-primary dark:bg-surface-elevated">
                <Stethoscope className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{name}</p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  {t("doctorCount", { count: specialty.doctorCount })}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
