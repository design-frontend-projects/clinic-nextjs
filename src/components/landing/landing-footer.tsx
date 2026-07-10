import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";

export function LandingFooter() {
  const t = useTranslations("landing.footer");
  const tBrand = useTranslations("brand");

  return (
    <footer className="border-t border-hairline-soft">
      <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-4 px-4 py-10 sm:flex-row sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
            <Activity className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">
            {tBrand("name")}
          </span>
        </Link>
        <p className="text-xs text-muted-foreground">{t("copyright")}</p>
      </div>
    </footer>
  );
}
