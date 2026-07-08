import { LandingUserNav } from "@/components/layout/landing-user-nav";
import { Button } from "@/components/ui/button";
import { getSupabaseSession, getTenantInfo } from "@/lib/auth";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle,
  Cpu,
  Database,
  Globe,
  Receipt,
  Search,
  Sparkles,
  Stethoscope,
  Terminal,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/routing";

const features = [
  {
    icon: CalendarDays,
    title: "Appointment Management",
    description:
      "Smart scheduling with conflict detection, status workflow, and calendar views.",
    accentColor: "text-[#57c1ff]",
    borderColor: "hover:border-[#57c1ff]/30",
  },
  {
    icon: Users,
    title: "Patient Records",
    description:
      "Complete patient profiles with medical history, documents, and visit tracking.",
    accentColor: "text-[#59d499]",
    borderColor: "hover:border-[#59d499]/30",
  },
  {
    icon: Stethoscope,
    title: "Staff Management",
    description:
      "Role-based access for doctors, nurses, and receptionists with schedule management.",
    accentColor: "text-[#ffc533]",
    borderColor: "hover:border-[#ffc533]/30",
  },
  {
    icon: Receipt,
    title: "Billing & Invoicing",
    description:
      "Create invoices, track payments, manage insurance claims, and generate reports.",
    accentColor: "text-[#ff6161]",
    borderColor: "hover:border-[#ff6161]/30",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Real-time KPIs, revenue tracking, doctor performance, and patient growth metrics.",
    accentColor: "text-[#57c1ff]",
    borderColor: "hover:border-[#57c1ff]/30",
  },
  {
    icon: Activity,
    title: "Pharmacy & Inventory",
    description:
      "Medication management, batch tracking, purchase orders, and stock alerts.",
    accentColor: "text-[#59d499]",
    borderColor: "hover:border-[#59d499]/30",
  },
];

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for small clinics",
    features: [
      "Up to 100 patients",
      "2 staff members",
      "Basic appointments",
      "Email support",
    ],
  },
  {
    name: "Professional",
    price: "$49",
    period: "/month",
    description: "For growing practices",
    popular: true,
    features: [
      "Unlimited patients",
      "10 staff members",
      "Advanced scheduling",
      "Billing & invoicing",
      "Lab management",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    price: "$149",
    period: "/month",
    description: "For multi-branch clinics",
    features: [
      "Everything in Pro",
      "Unlimited staff",
      "Multi-branch",
      "Custom integrations",
      "Dedicated support",
      "SLA guarantee",
    ],
  },
];

const integrations = [
  { name: "Supabase DB", type: "Storage", status: "Connected", icon: Database },
  { name: "Composio AI", type: "AI Agents", status: "Active", icon: Cpu },
  { name: "Stripe", type: "Payments", status: "Active", icon: Receipt },
  { name: "WhatsApp", type: "SMS Alert", status: "Active", icon: Globe },
];

export default async function LandingPage() {
  const session = await getSupabaseSession();

  let dashboardPath = "/dashboard/admin";
  let fullName = null;
  let email = session?.user?.email || null;

  if (session) {
    const tenant = await getTenantInfo();
    if (tenant) {
      fullName = tenant.fullName;
      email = tenant.email || email;
      const role = tenant.role;
      if (role === "app_owner") {
        dashboardPath = "/dashboard/app-owner";
      } else if (role === "staff") {
        dashboardPath = "/dashboard/staff";
      } else if (role === "doctor") {
        dashboardPath = "/dashboard/doctor";
      } else if (role === "admin") {
        dashboardPath = "/admin";
      }
    } else {
      const roles = session.user.app_metadata?.roles as string[] | undefined;
      if (roles?.includes("app_owner")) dashboardPath = "/dashboard/app-owner";
      else if (roles?.includes("staff")) dashboardPath = "/dashboard/staff";
      else if (roles?.includes("doctor")) dashboardPath = "/dashboard/doctor";
    }
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-[#ffffff] font-sans selection:bg-[#ffffff] selection:text-[#000000] relative overflow-hidden">
      {/* Raycast launch banner top-edge border */}
      <div className="absolute top-0 inset-x-0 h-1.5 flex justify-center gap-1.5 opacity-90 z-50 pointer-events-none">
        <div className="w-24 h-full bg-gradient-to-r from-[#ff5757] to-[#a1131a] rounded-b-sm" />
        <div className="w-24 h-full bg-gradient-to-r from-[#ff5757] to-[#a1131a] rounded-b-sm" />
        <div className="w-24 h-full bg-gradient-to-r from-[#ff5757] to-[#a1131a] rounded-b-sm" />
      </div>

      {/* Diagonal background launch-banner stripes */}
      <div className="absolute top-0 right-0 left-0 h-[400px] overflow-hidden pointer-events-none -z-20 opacity-20 select-none">
        <div className="absolute -top-[150px] left-1/2 -translate-x-1/2 w-[1200px] h-[500px] rotate-12 flex gap-8 justify-center">
          <div className="w-[12px] h-[800px] bg-gradient-to-b from-[#ff5757] to-[#a1131a]/10" />
          <div className="w-[12px] h-[800px] bg-gradient-to-b from-[#ff5757] to-[#a1131a]/10" />
          <div className="w-[12px] h-[800px] bg-gradient-to-b from-[#ff5757] to-[#a1131a]/10" />
        </div>
      </div>

      {/* Spotlight Glow Background behind Hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(87,193,255,0.05)_0%,transparent_60%)] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#242728] bg-[#07080a]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 max-w-6xl">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ffffff] transition-transform group-hover:scale-105">
              <Activity className="h-5 w-5 text-[#000000]" />
            </div>
            <span className="text-lg font-medium tracking-tight text-[#ffffff]">
              Clinic<span className="text-[#57c1ff]">Pro</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {!session ? (
              <>
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="text-[#9c9c9d] hover:text-[#ffffff] hover:bg-[#101111] text-xs px-3.5 py-1.5 rounded-full transition-colors"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-[#ffffff] text-[#000000] hover:bg-[#e8e8e8] border-none text-xs px-4 py-1.5 rounded-full font-medium transition-all shadow-sm">
                    Start Free Trial
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              </>
            ) : (
              <LandingUserNav
                fullName={fullName}
                email={email}
                dashboardPath={dashboardPath}
              />
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 pt-24 pb-12 text-center relative z-10 max-w-6xl">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#242728] bg-[#0d0d0d] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#57c1ff]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#59d499] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#59d499]"></span>
            </span>
            AI-Driven Medical Infrastructure
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold tracking-tight leading-[1.1] text-[#ffffff] font-sans">
            Modern Clinic <br />
            <span className="bg-gradient-to-r from-[#57c1ff] via-[#ffffff] to-[#ff5757] bg-clip-text text-transparent">
              Management System
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base md:text-lg text-[#9c9c9d] leading-relaxed">
            An API-first SaaS platform for appointments, electronic health
            records, billing, and automated patient workflows — built with the
            performance of a developer console.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {!session ? (
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="bg-[#ffffff] text-[#000000] hover:bg-[#e8e8e8] border-none text-sm px-6 h-11 rounded-full font-medium shadow-sm transition-all"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href={'/admin'}>
                <Button
                  size="lg"
                  className="bg-[#ffffff] text-[#000000] hover:bg-[#e8e8e8] border-none text-sm px-6 h-11 rounded-full font-medium shadow-sm transition-all"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              variant="outline"
              className="bg-transparent border border-[#242728] text-[#ffffff] hover:bg-[#101111] text-sm px-6 h-11 rounded-full font-medium transition-all"
            >
              Watch Developer Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Command Palette Mockup Section */}
      <section className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="relative rounded-[12px] border border-[#242728] bg-[#0d0d0d] shadow-[0_24px_60px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Spotlight inside mockup */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(87,193,255,0.03)_0%,transparent_50%)] pointer-events-none" />

          {/* Search Bar */}
          <div className="relative flex h-12 items-center border-b border-[#242728] px-4 gap-3 bg-[#0d0d0d] z-10">
            <Search className="h-4 w-4 text-[#6a6b6c]" />
            <span className="text-[#9c9c9d] text-sm flex-1 select-none">
              Search commands, patient records, or actions...
            </span>
            <kbd className="inline-flex items-center gap-0.5 rounded-[4px] border border-[#242728] bg-[#121212] px-1.5 py-0.5 text-[9px] font-mono text-[#9c9c9d] select-none">
              ⌘K
            </kbd>
          </div>

          {/* Search Results Area */}
          <div className="relative p-2 space-y-4 z-10">
            {/* Section: Patients */}
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono tracking-wider text-[#6a6b6c] uppercase">
                Patients & Scheduling
              </div>
              <div className="space-y-0.5">
                {/* Row 1 (Active) */}
                <div className="flex items-center justify-between rounded-[6px] bg-[#121212] px-3 py-2 text-sm text-[#ffffff] group cursor-pointer border border-[#242728]/40">
                  <div className="flex items-center gap-3">
                    <Users className="h-4 w-4 text-[#59d499]" />
                    <span className="font-medium">Sarah Jenkins</span>
                    <span className="rounded-[4px] bg-[#59d499]/10 border border-[#59d499]/20 text-[#59d499] px-1.5 py-0.5 text-[10px] font-medium">
                      Active Care
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#9c9c9d] font-normal">Open Records</span>
                    <kbd className="rounded-[4px] border border-[#242728] bg-[#101111] px-1.5 py-0.5 text-[9px] font-mono text-[#9c9c9d]">
                      ↵
                    </kbd>
                  </div>
                </div>

                {/* Row 2 */}
                <div className="flex items-center justify-between rounded-[6px] bg-transparent px-3 py-2 text-sm text-[#cdcdcd] hover:bg-[#121212]/50 group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-[#57c1ff]" />
                    <span>Schedule Cardiology Follow-up</span>
                    <span className="rounded-[4px] bg-[#57c1ff]/10 border border-[#57c1ff]/20 text-[#57c1ff] px-1.5 py-0.5 text-[10px] font-medium">
                      AI Suggestion
                    </span>
                  </div>
                  <kbd className="hidden group-hover:inline-block rounded-[4px] border border-[#242728] bg-[#101111] px-1.5 py-0.5 text-[9px] font-mono text-[#9c9c9d]">
                    Tab
                  </kbd>
                </div>
              </div>
            </div>

            {/* Section: Medical Actions */}
            <div>
              <div className="px-3 py-1.5 text-[10px] font-mono tracking-wider text-[#6a6b6c] uppercase">
                Clinical Workflow
              </div>
              <div className="space-y-0.5">
                {/* Row 3 */}
                <div className="flex items-center justify-between rounded-[6px] bg-transparent px-3 py-2 text-sm text-[#cdcdcd] hover:bg-[#121212]/50 group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Stethoscope className="h-4 w-4 text-[#ffc533]" />
                    <span>Create Prescription (Amoxicillin 500mg)</span>
                    <span className="text-xs text-[#9c9c9d] ml-1">Dr. Robert Chen</span>
                  </div>
                  <kbd className="hidden group-hover:inline-block rounded-[4px] border border-[#242728] bg-[#101111] px-1.5 py-0.5 text-[9px] font-mono text-[#9c9c9d]">
                    ↵
                  </kbd>
                </div>

                {/* Row 4 */}
                <div className="flex items-center justify-between rounded-[6px] bg-transparent px-3 py-2 text-sm text-[#cdcdcd] hover:bg-[#121212]/50 group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Receipt className="h-4 w-4 text-[#ff6161]" />
                    <span>Generate Patient Invoice (INV-9812)</span>
                    <span className="rounded-[4px] bg-[#ff6161]/10 border border-[#ff6161]/20 text-[#ff6161] px-1.5 py-0.5 text-[10px] font-medium">
                      $75.00
                    </span>
                  </div>
                  <kbd className="hidden group-hover:inline-block rounded-[4px] border border-[#242728] bg-[#101111] px-1.5 py-0.5 text-[9px] font-mono text-[#9c9c9d]">
                    ↵
                  </kbd>
                </div>
              </div>
            </div>
          </div>

          {/* Command Palette Status Bar */}
          <div className="relative flex h-9 items-center justify-between border-t border-[#242728] bg-[#07080a] px-4 text-[11px] text-[#9c9c9d] font-mono z-10">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#59d499] animate-pulse" />
              <span>ClinicPro AI Copilot Active</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span>Use</span>
              <kbd className="rounded-[4px] border border-[#242728] bg-[#121212] px-1 py-0.2 text-[9px] font-mono">↑↓</kbd>
              <span>to navigate,</span>
              <kbd className="rounded-[4px] border border-[#242728] bg-[#121212] px-1 py-0.2 text-[9px] font-mono">↵</kbd>
              <span>to open</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="container mx-auto px-4 py-24 relative z-10 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#ffffff] leading-tight">
            Built for modern medical teams
          </h2>
          <p className="mt-4 text-[#9c9c9d] text-base">
            High-performance modules designed to run clinic operations with command console efficiency.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className={`group rounded-[10px] border border-[#242728] bg-[#0d0d0d] p-6 hover:bg-[#121212] transition-all duration-300 ${feature.borderColor}`}
            >
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-[#121212] border border-[#242728] transition-colors group-hover:bg-[#101111]">
                <feature.icon className={`h-5 w-5 ${feature.accentColor} transition-transform group-hover:scale-105`} />
              </div>
              <h3 className="mb-2 text-base font-semibold text-[#ffffff]">
                {feature.title}
              </h3>
              <p className="text-sm text-[#9c9c9d] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="container mx-auto px-4 py-24 border-t border-[#242728] relative z-10 max-w-6xl">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#ffffff] leading-tight">
            Simple developer pricing
          </h2>
          <p className="mt-4 text-[#9c9c9d] text-base">
            Start free, scale as your practices expand.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[12px] border p-6 flex flex-col justify-between transition-all duration-300 bg-[#0d0d0d] hover:scale-[1.01] ${
                plan.popular
                  ? "border-[#ffffff] shadow-[0_0_30px_rgba(255,255,255,0.05)] bg-[#101111]"
                  : "border-[#242728]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-[#ffffff] bg-[#ffffff] text-[#000000] px-3.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider">
                  Most Popular
                </div>
              )}
              <div>
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-[#ffffff]">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-[#9c9c9d] mt-1 leading-snug">
                    {plan.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold text-[#ffffff]">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-xs text-[#9c9c9d]">
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>
                <ul className="mb-8 space-y-2.5 border-t border-[#242728]/60 pt-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-xs text-[#cdcdcd]"
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-[#59d499] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                className={`w-full h-9 text-xs rounded-full font-medium transition-all ${
                  plan.popular
                    ? "bg-[#ffffff] hover:bg-[#e8e8e8] text-[#000000] border-none"
                    : "bg-[#101111] hover:bg-[#121212] text-[#ffffff] border border-[#242728]"
                }`}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Integrations Grid using App Icon Tiles */}
      <section className="container mx-auto px-4 py-20 border-t border-[#242728] relative z-10 max-w-4xl">
        <div className="text-center mb-12 max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#ffffff]">
            Console-Grade Integrations
          </h2>
          <p className="mt-3 text-sm text-[#9c9c9d]">
            Connected with active services through robust APIs and event triggers.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {integrations.map((item) => (
            <div
              key={item.name}
              className="flex items-center gap-3 rounded-lg border border-[#242728] bg-[#0d0d0d] p-3.5 hover:bg-[#121212] transition-colors"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-[#121212] border border-[#242728]">
                <item.icon className="h-5 w-5 text-[#57c1ff]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#ffffff] truncate">
                  {item.name}
                </p>
                <p className="text-[10px] text-[#9c9c9d] mt-0.5 truncate">
                  {item.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#242728] bg-[#07080a] py-12 relative z-10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6 max-w-6xl">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#57c1ff]" />
            <span className="font-semibold text-[#ffffff]">ClinicPro</span>
          </div>
          <p className="text-xs text-[#9c9c9d]">
            © 2026 ClinicPro. All rights reserved. Powered by the Raycast Inspired Design System.
          </p>
          <div className="flex gap-4 text-xs text-[#9c9c9d]">
            <Link href="#" className="hover:text-[#ffffff] transition-colors">
              API Docs
            </Link>
            <Link href="#" className="hover:text-[#ffffff] transition-colors">
              GitHub
            </Link>
            <Link href="#" className="hover:text-[#ffffff] transition-colors">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
