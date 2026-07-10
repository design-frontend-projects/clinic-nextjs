import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { LandingUserNav } from "@/components/layout/landing-user-nav";

type LandingNavProps = {
  isAuthenticated: boolean;
  dashboardPath: string;
  fullName: string | null;
  email: string | null;
};

export function LandingNav({
  isAuthenticated,
  dashboardPath,
  fullName,
  email,
}: LandingNavProps) {
  const t = useTranslations("landing.nav");
  const tBrand = useTranslations("brand");

  const links = [
    { href: "#features", label: t("features") },
    { href: "#specialties", label: t("specialties") },
    { href: "#pricing", label: t("pricing") },
    { href: "#testimonials", label: t("testimonials") },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-hairline-soft bg-canvas/95 backdrop-blur supports-backdrop-filter:bg-canvas/80">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Activity className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-base font-semibold tracking-tight text-foreground">
            {tBrand("name")}
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {isAuthenticated ? (
            <LandingUserNav
              dashboardPath={dashboardPath}
              fullName={fullName}
              email={email}
            />
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/sign-in">{t("signIn")}</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/sign-up">{t("startFreeTrial")}</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
