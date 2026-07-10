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
    <section id="specialties" className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <p className="text-center text-eyebrow font-medium text-muted-foreground">
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
            locale === "ar" && specialty.name_ar ? specialty.name_ar : specialty.name;
          return (
            <div
              key={specialty.id}
              className="flex items-start gap-3 rounded-lg border border-hairline bg-card p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                <Stethoscope className="h-4 w-4 text-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">{name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
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
