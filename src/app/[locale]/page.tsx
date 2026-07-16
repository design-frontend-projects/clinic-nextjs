import { getSupabaseSession, getTenantInfo } from "@/lib/auth";
import { roleHomePath, DEFAULT_HOME_PATH } from "@/lib/role-routes";
import {
  getPublicPlans,
  getPublicSpecialties,
  getPublicStats,
  getPublicTestimonials,
} from "@/lib/public-data";
import { LandingNav } from "@/components/landing/landing-nav";
import { Hero } from "@/components/landing/hero";
import { StatsSection } from "@/components/landing/stats-section";
import { FeaturesSection } from "@/components/landing/features-section";
import { SpecialtiesSection } from "@/components/landing/specialties-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { TestimonialsSection } from "@/components/landing/testimonials-section";
import { CtaBanner } from "@/components/landing/cta-banner";
import { LandingFooter } from "@/components/landing/landing-footer";

export default async function LandingPage() {
  const [session, stats, specialties, plans, testimonials] = await Promise.all([
    getSupabaseSession(),
    getPublicStats(),
    getPublicSpecialties(),
    getPublicPlans(),
    getPublicTestimonials(),
  ]);

  let dashboardPath = DEFAULT_HOME_PATH;
  let fullName: string | null = null;
  let email = session?.user?.email ?? null;

  if (session) {
    const tenant = await getTenantInfo();
    if (tenant) {
      fullName = tenant.fullName;
      email = tenant.email || email;
      dashboardPath = roleHomePath(tenant.role);
    } else {
      const roles = session.user.app_metadata?.roles as string[] | undefined;
      const jwtRole = roles?.find((r) => roleHomePath(r) !== DEFAULT_HOME_PATH);
      if (jwtRole) dashboardPath = roleHomePath(jwtRole);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-foreground">
      <LandingNav
        isAuthenticated={Boolean(session)}
        dashboardPath={dashboardPath}
        fullName={fullName}
        email={email}
      />
      <main>
        <Hero isAuthenticated={Boolean(session)} dashboardPath={dashboardPath} />
        <StatsSection stats={stats} />
        <FeaturesSection />
        <SpecialtiesSection specialties={specialties} />
        <PricingSection plans={plans} />
        <TestimonialsSection testimonials={testimonials} />
        <CtaBanner />
      </main>
      <LandingFooter />
    </div>
  );
}
