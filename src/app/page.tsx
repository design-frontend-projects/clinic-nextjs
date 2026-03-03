import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
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

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ClinicPro</span>
          </Link>
          <div className="flex items-center gap-4">
            <SignedOut>
              <Link href="/sign-in">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/sign-up">
                <Button>
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button variant="ghost" className="mr-2">
                  Dashboard
                </Button>
              </Link>
              <UserButton
                afterSignOutUrl="/"
                appearance={{
                  elements: {
                    avatarBox: "h-9 w-9",
                  },
                }}
              />
            </SignedIn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-24 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="inline-flex items-center rounded-full border px-4 py-1.5 text-sm font-medium">
            🏥 Trusted by 500+ clinics worldwide
          </div>
          <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Modern Clinic{" "}
            <span className="bg-linear-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Management
            </span>
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            All-in-one SaaS platform for managing appointments, patients, staff,
            billing, and pharmacy — built for modern healthcare.
          </p>
          <div className="flex items-center justify-center gap-4">
            <SignedOut>
              <Link href="/sign-up">
                <Button size="lg" className="h-12 px-8 text-base">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </SignedOut>
            <SignedIn>
              <Link href="/dashboard">
                <Button size="lg" className="h-12 px-8 text-base">
                  Go to Dashboard
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </SignedIn>
            <Button size="lg" variant="outline" className="h-12 px-8 text-base">
              Watch Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything you need to run your clinic
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Powerful modules designed for modern healthcare practices
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-xl border p-6 transition-all hover:border-primary/50 hover:shadow-lg"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
                <feature.icon className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="container mx-auto px-4 py-24 border-t">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free, scale as you grow
          </p>
        </div>
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-xl border p-8 ${
                plan.popular
                  ? "border-primary shadow-lg ring-1 ring-primary"
                  : ""
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-medium text-primary-foreground">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-xl font-bold">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {plan.description}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">{plan.price}</span>
                  {plan.period && (
                    <span className="text-muted-foreground">{plan.period}</span>
                  )}
                </div>
              </div>
              <ul className="mb-8 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-500" />
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                className="w-full"
                variant={plan.popular ? "default" : "outline"}
              >
                Get Started
              </Button>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <span className="font-bold">ClinicPro</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2026 ClinicPro. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
