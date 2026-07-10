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
    <section className="mx-auto max-w-[1280px] px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28">
      <p className="mx-auto mb-6 flex w-fit items-center gap-2 text-eyebrow font-medium text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-fin" aria-hidden />
        {t("aiDriven")}
      </p>
      <h1 className="mx-auto max-w-4xl text-display-md sm:text-display-lg lg:text-display-xl text-foreground">
        {t("title")}
        <br />
        {t("subtitle")}
      </h1>
      <p className="mx-auto mt-6 max-w-2xl text-subhead text-muted-foreground">
        {t("description")}
      </p>
      <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
        {isAuthenticated ? (
          <Button asChild size="lg">
            <Link href={dashboardPath}>
              {t("goToDashboard")}
              <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
            </Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/sign-up">
                {t("getStartedFree")}
                <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/sign-in">{t("watchDemo")}</Link>
            </Button>
          </>
        )}
      </div>
    </section>
  );
}
