import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

export function CtaBanner() {
  const t = useTranslations("landing.cta");

  return (
    <section className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-hairline bg-card p-8 text-center sm:p-12">
        <h2 className="mx-auto max-w-2xl text-headline text-foreground">
          {t("title")}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-subhead text-muted-foreground">
          {t("subtitle")}
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link href="/sign-up">
            {t("button")}
            <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Link>
        </Button>
      </div>
    </section>
  );
}
