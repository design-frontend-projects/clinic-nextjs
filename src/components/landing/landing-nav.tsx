import { Activity } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { LandingUserNav } from "@/components/layout/landing-user-nav";
import { LandingControls } from "@/components/landing/landing-controls";

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
    <header className="sticky top-0 z-50 border-b border-hairline bg-surface/95 backdrop-blur supports-backdrop-filter:bg-surface/85 dark:bg-canvas/95 dark:supports-backdrop-filter:bg-canvas/90">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-button)] bg-primary text-primary-foreground">
            <Activity className="h-4 w-4" />
          </div>
          <span className="text-base font-bold tracking-tight text-foreground">
            {tBrand("name")}
          </span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground dark:font-semibold"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LandingControls />
          {isAuthenticated ? (
            <LandingUserNav
              dashboardPath={dashboardPath}
              fullName={fullName}
              email={email}
            />
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
              >
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
