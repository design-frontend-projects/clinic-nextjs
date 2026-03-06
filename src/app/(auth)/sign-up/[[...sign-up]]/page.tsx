"use client";

import { useSignUp, useAuth, useUser } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";
import { Activity, CheckCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { OnboardingDialog } from "@/components/onboarding/onboarding-dialog";
import { toast } from "sonner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { useRouter } from "next/navigation";

const highlights = [
  "Manage appointments & patients",
  "Complete billing & invoicing",
  "Role-based staff access",
  "Real-time analytics dashboard",
  "Pharmacy & inventory tracking",
];

export default function CustomSignUpPage() {
  const { isLoaded: isSignUpLoaded, signUp, setActive } = useSignUp();
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const supabase = createSupabaseServerClient();
  const router = useRouter();

  const [step, setStep] = useState<"account" | "verification" | "onboarding">(
    "account",
  );

  // Check if user already completed onboarding → redirect to /admin
  // Check if user already completed onboarding → redirect to /admin
  const checkIfProfileCompleted = useCallback(async () => {
    if (!user?.id) return;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("clerk_user_id", user.id)
      .single();

    if (profile?.is_profile_completed) {
      router.push("/admin");
    } else {
      // Profile exists but not completed → show onboarding
      setStep("onboarding");
    }
  }, [user?.id, supabase, router]);

  // When user is already authenticated, check profile status
  useEffect(() => {
    if (isAuthLoaded && isSignedIn && user?.id && step === "account") {
      checkIfProfileCompleted();
    }
  }, [isAuthLoaded, isSignedIn, user?.id, step, checkIfProfileCompleted]);

  // Form state
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [code, setCode] = useState("");

  // Loading state
  const [loading, setLoading] = useState(false);

  // 1. Create Clerk Account
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded) return;
    setLoading(true);

    try {
      await signUp.create({
        emailAddress,
        password,
        firstName,
        lastName,
      });

      // Send verification email
      await signUp.prepareEmailAddressVerification({
        strategy: "email_code",
      });

      setStep("verification");
    } catch (err: unknown) {
      const error = err as { errors?: { message?: string }[] };
      console.error(JSON.stringify(error, null, 2));
      toast.error(
        error.errors?.[0]?.message || "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 2. Verify Email → Open Onboarding Dialog
  const handleVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignUpLoaded) return;
    setLoading(true);

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code,
      });

      if (completeSignUp.status === "complete") {
        // Create profile in Supabase now that we have a valid Clerk user ID
        const clerkUserId = completeSignUp.createdUserId;
        const { error: profileError } = await supabase.from("profiles").upsert(
          {
            clerk_user_id: clerkUserId,
            email: emailAddress,
            full_name: firstName + " " + lastName,
            is_profile_completed: false,
            role: "admin",
          },
          { onConflict: "clerk_user_id" },
        );

        if (profileError) {
          console.error("Error creating profile:", profileError);
          toast.error("Failed to create profile.");
        }

        await setActive({ session: completeSignUp.createdSessionId });
        setStep("onboarding");
      } else {
        console.error(JSON.stringify(completeSignUp, null, 2));
        toast.error("Verification incomplete. Check the console for details.");
      }
    } catch (err: unknown) {
      const error = err as { errors?: { message?: string }[] };
      console.error(JSON.stringify(error, null, 2));
      toast.error(error.errors?.[0]?.message || "Invalid verification code");
    } finally {
      setLoading(false);
    }
  };

  const formFullName = [firstName, lastName].filter(Boolean).join(" ");
  const defaultFullName = formFullName || user?.fullName || "";
  const defaultEmail =
    emailAddress || user?.primaryEmailAddress?.emailAddress || "";

  return (
    <div className="flex min-h-screen">
      {/* Left — Feature Panel */}
      <div className="hidden w-1/2 bg-linear-to-br from-primary via-primary/90 to-primary/70 p-12 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Activity className="h-6 w-6" />
            </div>
            <span className="text-2xl font-bold">ClinicPro</span>
          </Link>
        </div>

        <div className="space-y-8">
          <div className="space-y-3">
            <h1 className="text-4xl font-bold leading-tight">
              Start managing your clinic today
            </h1>
            <p className="text-lg text-primary-foreground/80">
              Join 500+ clinics already using ClinicPro to streamline their
              operations.
            </p>
          </div>

          <ul className="space-y-4">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-3">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <CheckCircle className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-primary-foreground/60">
          © {new Date().getFullYear()} ClinicPro. All rights reserved.
        </p>
      </div>

      {/* Right — Active Step Form */}
      <div className="flex w-full flex-col items-center justify-center bg-linear-to-br from-primary/5 via-background to-primary/10 px-4 lg:w-1/2">
        <div className="mb-6 text-center lg:hidden">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Activity className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">ClinicPro</span>
          </Link>
        </div>

        {step === "account" && (
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle>Create an account</CardTitle>
              <CardDescription>
                Enter your details to get started.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              </form>
            </CardContent>
            <CardFooter className="justify-center border-t p-4 pb-4">
              <p className="text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  href="/sign-in"
                  className="font-medium text-primary hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </Card>
        )}

        {step === "verification" && (
          <Card className="w-full max-w-md shadow-xl">
            <CardHeader>
              <CardTitle>Verify your email</CardTitle>
              <CardDescription>
                We&apos;ve sent a code to {emailAddress}.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleVerification} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Verification Code</Label>
                  <Input
                    id="code"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Enter code"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Verify
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Onboarding happens via dialog now — the card below is just a loading state */}
        {step === "onboarding" && (
          <Card className="w-full max-w-md shadow-xl border-primary/20">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <CheckCircle className="h-12 w-12 text-primary mb-4" />
              <p className="text-lg font-semibold">Account verified!</p>
              <p className="text-sm text-muted-foreground mt-1">
                Setting up your workspace...
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Onboarding Dialog — fires after verification */}
      <OnboardingDialog
        open={step === "onboarding"}
        defaultEmail={defaultEmail}
        defaultFullName={defaultFullName}
      />
    </div>
  );
}
