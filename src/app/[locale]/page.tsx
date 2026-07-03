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
  },
  {
    icon: Users,
    title: "Patient Records",
    description:
      "Complete patient profiles with medical history, documents, and visit tracking.",
  },
  {
    icon: Stethoscope,
    title: "Staff Management",
    description:
      "Role-based access for doctors, nurses, and receptionists with schedule management.",
  },
  {
    icon: Receipt,
    title: "Billing & Invoicing",
    description:
      "Create invoices, track payments, manage insurance claims, and generate reports.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    description:
      "Real-time KPIs, revenue tracking, doctor performance, and patient growth metrics.",
  },
  {
    icon: Activity,
    title: "Pharmacy & Inventory",
    description:
      "Medication management, batch tracking, purchase orders, and stock alerts.",
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
      }
    } else {
      const roles = session.user.app_metadata?.roles as string[] | undefined;
      if (roles?.includes("app_owner")) dashboardPath = "/dashboard/app-owner";
      else if (roles?.includes("staff")) dashboardPath = "/dashboard/staff";
      else if (roles?.includes("doctor")) dashboardPath = "/dashboard/doctor";
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white font-sans selection:bg-[#0007cd] selection:text-white relative overflow-hidden">
      {/* Spotlight Glow Background behind Hero */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[radial-gradient(circle_at_center,rgba(26,38,255,0.12)_0%,transparent_60%)] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-[#222222] bg-[#0f0f0f]/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0007cd] transition-transform group-hover:scale-105">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-medium tracking-tight text-white">
              Clinic<span className="text-[#00d4ff]">Pro</span>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {!session ? (
              <>
                <Link href="/sign-in">
                  <Button
                    variant="ghost"
                    className="text-[#a8a8a8] hover:text-white hover:bg-[#181818] text-sm"
                  >
                    Sign In
                  </Button>
                </Link>
                <Link href="/sign-up">
                  <Button className="bg-[#0007cd] text-white hover:bg-[#0005a3] border-none text-sm px-4">
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
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
      <section className="container mx-auto px-4 pt-20 pb-12 text-center relative z-10">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#222222] bg-[#181818] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#00d4ff]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#33d17a] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#33d17a]"></span>
            </span>
            AI-Driven Medical Infrastructure
          </div>

          <h1 className="text-4xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1] text-white">
            Modern Clinic <br />
            <span className="bg-gradient-to-r from-[#00d4ff] via-white to-[#7b3aed] bg-clip-text text-transparent">
              Management System
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-base md:text-lg text-[#a8a8a8]">
            An API-first SaaS platform for appointments, electronic health
            records, billing, and automated patient workflows — powered by
            intelligent agent integrations.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            {!session ? (
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="bg-[#0007cd] text-white hover:bg-[#0005a3] border-none text-base px-6 h-12"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button
                  size="lg"
                  className="bg-[#0007cd] text-white hover:bg-[#0005a3] border-none text-base px-6 h-12"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            <Button
              size="lg"
              variant="secondary"
              className="bg-[#181818] border border-[#222222] text-white hover:bg-[#222222] text-base px-6 h-12"
            >
              Watch Developer Demo
            </Button>
          </div>
        </div>
      </section>

      {/* 2x2 Terminal Mockup Grid - Composio Brand Signature */}
      <section className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="relative rounded-xl border border-[#222222] bg-[#000000] p-4 md:p-6 shadow-[0_0_50px_rgba(26,38,255,0.15)] overflow-hidden">
          {/* Spotlight behind mockup */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(26,38,255,0.08)_0%,transparent_50%)] pointer-events-none" />

          {/* Terminal header */}
          <div className="flex items-center justify-between border-b border-[#222222] pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#ff4d4d]" />
              <div className="h-3 w-3 rounded-full bg-[#f5a623]" />
              <div className="h-3 w-3 rounded-full bg-[#33d17a]" />
              <span className="ml-2 font-mono text-xs text-[#888888]">
                clinic-agent-workspace
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-[#00d4ff]">
              <span className="h-2 w-2 rounded-full bg-[#33d17a] animate-pulse" />
              LIVE SYSTEM
            </div>
          </div>

          {/* 2x2 Grid of dark code/output panels */}
          <div className="grid gap-4 md:grid-cols-2 relative z-10">
            {/* Panel 1: Code Request */}
            <div className="rounded-lg border border-[#222222] bg-[#181818] p-4 font-mono text-xs text-[#a8a8a8] flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-center justify-between text-[#888888] mb-2 border-b border-[#222222]/50 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-[#00d4ff]" />{" "}
                    trigger_event.json
                  </span>
                  <span className="text-[#33d17a]">POST 201</span>
                </div>
                <pre className="text-white overflow-x-auto">
                  {`{
  "event": "appointment.scheduled",
  "patient_id": "pat_91823",
  "doctor_id": "doc_cardio_1",
  "datetime": "2026-07-02T18:00:00Z"
}`}
                </pre>
              </div>
              <div className="mt-2 text-[10px] text-[#888888] flex items-center gap-1 justify-end">
                <span>payload size: 120 bytes</span>
              </div>
            </div>

            {/* Panel 2: Live AI Copilot */}
            <div className="rounded-lg border border-[#222222] bg-[#181818] p-4 font-mono text-xs text-[#a8a8a8] flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-center justify-between text-[#888888] mb-2 border-b border-[#222222]/50 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-[#7b3aed]" />{" "}
                    clinic-copilot-ai
                  </span>
                  <span className="text-[#00d4ff]">Processing</span>
                </div>
                <div className="space-y-1 text-white">
                  <p className="text-[#888888]">
                    &gt; Fetching patient history...
                  </p>
                  <p className="text-[#33d17a]">
                    &gt; No medication conflicts detected.
                  </p>
                  <p className="text-white font-medium">
                    &gt; Recommended: ECG monitoring scheduled.
                  </p>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-[#888888] flex items-center gap-1 justify-end">
                <span>latency: 140ms</span>
              </div>
            </div>

            {/* Panel 3: Event Stream Logs */}
            <div className="rounded-lg border border-[#222222] bg-[#181818] p-4 font-mono text-xs text-[#a8a8a8] flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-center justify-between text-[#888888] mb-2 border-b border-[#222222]/50 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[#ff4d4d]" />{" "}
                    activity_stream.log
                  </span>
                  <span className="text-[#33d17a]">Streaming</span>
                </div>
                <div className="space-y-1.5 text-[11px]">
                  <p className="text-[#888888]">
                    <span className="text-white">[17:25:01]</span> Patient
                    Pat_91823 check-in initiated
                  </p>
                  <p className="text-[#888888]">
                    <span className="text-white">[17:25:12]</span> Invoice
                    INV-2901 generated successfully ($49.00)
                  </p>
                  <p className="text-[#888888]">
                    <span className="text-white">[17:25:22]</span> SMS dispatch
                    queued via Twilio channel
                  </p>
                </div>
              </div>
              <div className="mt-2 text-[10px] text-[#888888] flex items-center gap-1 justify-end">
                <span>active sockets: 4</span>
              </div>
            </div>

            {/* Panel 4: Tool Integrations */}
            <div className="rounded-lg border border-[#222222] bg-[#181818] p-4 font-mono text-xs text-[#a8a8a8] flex flex-col justify-between min-h-[160px]">
              <div>
                <div className="flex items-center justify-between text-[#888888] mb-2 border-b border-[#222222]/50 pb-1.5">
                  <span className="flex items-center gap-1.5">
                    <Cpu className="h-3.5 w-3.5 text-[#00d4ff]" />{" "}
                    active_integrations
                  </span>
                  <span className="text-[#33d17a]">4 Connected</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {integrations.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center gap-1.5 rounded bg-[#222222] p-1.5 border border-[#333333]"
                    >
                      <item.icon className="h-3.5 w-3.5 text-[#00d4ff] shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-white truncate leading-tight">
                          {item.name}
                        </p>
                        <p className="text-[8px] text-[#888888] leading-none">
                          {item.type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="mt-2 text-[10px] text-[#888888] flex items-center gap-1 justify-end">
                <span>system: stable</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24 relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white leading-tight">
            Built for modern medical teams
          </h2>
          <p className="mt-4 text-[#a8a8a8] text-base md:text-lg">
            Powerful developer-first modules designed to run clinic operations
            with zero friction.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-lg border border-[#222222] bg-[#181818] p-6 hover:border-[#0007cd]/50 hover:bg-[#181818]/80 transition-all duration-300 transform hover:-translate-y-1"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-[#222222] transition-colors group-hover:bg-[#0007cd]/20">
                <feature.icon className="h-6 w-6 text-[#00d4ff] group-hover:text-white transition-colors" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">
                {feature.title}
              </h3>
              <p className="text-sm text-[#a8a8a8] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24 border-t border-[#222222] relative z-10">
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-medium tracking-tight text-white leading-tight">
            Simple developer pricing
          </h2>
          <p className="mt-4 text-[#a8a8a8] text-base md:text-lg">
            Start free, scale as your practices expand.
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-lg border p-8 bg-[#181818] flex flex-col justify-between transition-all duration-300 hover:scale-[1.02] ${
                plan.popular
                  ? "border-[#0007cd] shadow-[0_0_30px_rgba(0,7,205,0.2)]"
                  : "border-[#222222]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#0007cd] px-4 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                  Most Popular
                </div>
              )}
              <div>
                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-white">
                    {plan.name}
                  </h3>
                  <p className="text-sm text-[#a8a8a8] mt-1">
                    {plan.description}
                  </p>
                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold text-white">
                      {plan.price}
                    </span>
                    {plan.period && (
                      <span className="text-sm text-[#a8a8a8]">
                        {plan.period}
                      </span>
                    )}
                  </div>
                </div>
                <ul className="mb-8 space-y-3 border-t border-[#222222] pt-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-center gap-2 text-sm text-[#a8a8a8]"
                    >
                      <CheckCircle className="h-4 w-4 text-[#33d17a] shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <Button
                className={`w-full ${
                  plan.popular
                    ? "bg-[#0007cd] hover:bg-[#0005a3] text-white border-none"
                    : "bg-[#222222] hover:bg-[#2a2a2a] text-white border border-[#333333]"
                }`}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#222222] bg-[#000000] py-12 relative z-10">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-[#00d4ff]" />
            <span className="font-semibold text-white">ClinicPro</span>
          </div>
          <p className="text-sm text-[#888888]">
            © 2026 ClinicPro. All rights reserved. Built with the Composio
            Inspired Design System.
          </p>
          <div className="flex gap-4 text-sm text-[#888888]">
            <Link href="#" className="hover:text-white transition-colors">
              API Docs
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              GitHub
            </Link>
            <Link href="#" className="hover:text-white transition-colors">
              Status
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
