import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getSupabaseSession } from "@/lib/auth";
import {
  Activity,
  CalendarDays,
  Users,
  Stethoscope,
  Receipt,
  BarChart3,
  ArrowRight,
  CheckCircle,
} from "lucide-react";

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

export default async function LandingPage() {
  const session = await getSupabaseSession();

  return (
    <div className="min-h-screen bg-canvas font-inter" data-theme="dark">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-hairline bg-canvas/95 backdrop-blur supports-backdrop-filter:bg-canvas/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white">
              <Activity className="h-5 w-5 text-black" />
            </div>
            <span className="text-xl font-semibold text-ink">ClinicPro</span>
          </Link>
          <div className="flex items-center gap-4">
            {!session ? (
              <>
                <Link href="/sign-in">
                  <Button variant="secondary">Sign In</Button>
                </Link>
                <Link href="/sign-up">
                  <Button>
                    Start Free Trial
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/dashboard">
                  <Button variant="secondary" className="mr-2">
                    Dashboard
                  </Button>
                </Link>
                <Link href="/sign-in">
                  <Button variant="outline">Sign Out</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border border-hairline px-4 py-1.5 text-sm font-medium text-body">
            🏥 Trusted by 500+ clinics worldwide
          </div>
          <h1 className="text-6xl font-semibold tracking-tight text-ink sm:text-6xl lg:text-7xl">
            Modern Clinic{" "}
            <span className="bg-linear-to-r from-accent-blue to-accent-green bg-clip-text text-transparent">
              Management
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-body">
            All-in-one SaaS platform for managing appointments, patients, staff,
            billing, and pharmacy — built for modern healthcare.
          </p>
          <div className="flex items-center justify-center gap-4">
            {!session ? (
              <Link href="/sign-up">
                <Button size="lg" className="h-12 px-8 text-base">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard">
                <Button size="lg" className="h-12 px-8 text-base">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            )}
            <Button size="lg" variant="secondary" className="h-12 px-8 text-base">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-4xl text-ink">
            Everything you need to run your clinic
          </h2>
          <p className="mt-4 text-lg text-body">
            Powerful modules designed for modern healthcare practices
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-lg border border-hairline p-6 transition-all hover:border-hairline-strong"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-md bg-surface-elevated transition-colors group-hover:bg-surface-card">
                <feature.icon className="h-6 w-6 text-accent-blue" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-on-dark">{feature.title}</h3>
              <p className="text-sm text-body leading-relaxed font-inter">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24 border-t border-hairline">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-4xl text-ink">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-body">
            Start free, scale as you grow
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-lg border border-hairline p-8 ${
                plan.popular
                  ? "border-accent-blue"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-blue px-4 py-1 text-xs font-medium text-on-dark">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-on-dark">{plan.name}</h3>
                <p className="text-sm text-body">
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold text-on-dark">{plan.price}</span>
                  {plan.period && (
                    <span className="text-body">{plan.period}</span>
                  )}
                </div>
              </div>
              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-on-dark font-inter">
                    <CheckCircle className="h-4 w-4 text-accent-green" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "secondary"}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-hairline py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-accent-blue" />
            <span className="font-semibold text-on-dark">ClinicPro</span>
          </div>
          <p className="text-sm text-body">
            © 2026 ClinicPro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}