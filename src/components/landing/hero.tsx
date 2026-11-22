import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

type HeroProps = {
  isAuthenticated: boolean;
  dashboardPath: string;
};

export function Hero({ isAuthenticated, dashboardPath }: HeroProps) {
  const t = useTranslations("landing.hero");

  return (
    <section className="relative overflow-hidden border-b border-hairline bg-hero-bg text-hero-fg">
      {/* Subtle decorative sticker dots (Notion Light) / precision corner grid (NVIDIA Dark) */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden
      >
        <span className="absolute top-12 start-[10%] h-3 w-3 rounded-full bg-sticker-sky/80 dark:rounded-none dark:bg-primary" />
        <span className="absolute top-28 end-[12%] h-2.5 w-2.5 rounded-full bg-sticker-pink/80 dark:rounded-none dark:bg-primary/60" />
        <span className="absolute bottom-16 start-[16%] h-2.5 w-2.5 rounded-full bg-sticker-teal/80 dark:hidden" />
        <span className="absolute bottom-20 end-[18%] h-3 w-3 rounded-full bg-sticker-purple/80 dark:rounded-none dark:bg-primary/40" />
      </div>

      <div className="relative mx-auto max-w-[1280px] px-4 py-20 text-center sm:px-6 sm:py-28 lg:py-32">
        <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-[var(--radius-badge)] border border-white/15 bg-white/10 px-3.5 py-1 text-eyebrow font-semibold text-hero-fg dark:border-primary/40 dark:bg-primary/10 dark:uppercase dark:text-primary">
          <span
            className="inline-block h-2 w-2 rounded-full bg-sticker-sky dark:rounded-none dark:bg-primary"
            aria-hidden
          />
          {t("aiDriven")}
        </p>

        <h1 className="mx-auto max-w-4xl text-display-md text-hero-fg sm:text-display-lg lg:text-display-xl">
          {t("title")}
          <br />
          <span className="text-hero-fg/90 dark:text-primary">
            {t("subtitle")}
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-subhead text-hero-muted">
          {t("description")}
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3.5">
          {isAuthenticated ? (
            <Button asChild variant="cta" size="lg">
              <Link href={dashboardPath}>
                {t("goToDashboard")}
                <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="cta" size="lg">
                <Link href="/sign-up">
                  {t("getStartedFree")}
                  <ArrowRight className="ms-1 h-4 w-4 rtl:rotate-180" />
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
