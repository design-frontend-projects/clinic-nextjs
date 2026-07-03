"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SubscriptionSetupStep } from "@/components/onboarding/subscription-setup-step";
import { ClinicSetupStep } from "@/components/onboarding/clinic-setup-step";
import { BranchSetupStep } from "@/components/onboarding/branch-setup-step";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { saveClinicStep, saveBranchStep, getOnboardingProgress } from "@/app/actions/onboarding";
import type { ClinicFormData, BranchFormData, SubscriptionFormData } from "@/types/onboarding.types";
import { Loader2 } from "lucide-react";

type OnboardingFormProps = {
  defaultEmail?: string;
  defaultFullName?: string;
};

export function OnboardingForm({
  defaultEmail,
  defaultFullName,
}: OnboardingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);

  const {
    subscriptionData,
    clinicData,
    branchData,
    currentStep,
    clinicId,
    setSubscriptionData,
    setClinicData,
    setBranchData,
    setStep,
    setClinicId,
    clearOnboarding,
  } = useOnboardingStore();

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await getOnboardingProgress();
        if ("error" in res) {
          toast.error("Failed to load onboarding progress");
          return;
        }

        if (res.step === "completed") {
          router.push("/admin");
          return;
        }

        if ("data" in res && res.data) {
          const data = res.data as any;
          if (data.subscriptionData) setSubscriptionData(data.subscriptionData);
          if (data.clinicData) setClinicData(data.clinicData);
          if (data.branchData) setBranchData(data.branchData);
          if (data.clinicId) setClinicId(data.clinicId);
        }
        
        setStep(res.step as any);
      } catch (err) {
        console.error(err);
      } finally {
        setInitializing(false);
      }
    }
    loadProgress();
  }, [setSubscriptionData, setClinicData, setBranchData, setStep, setClinicId, router]);

  const handleSubscriptionSubmit = async (data: SubscriptionFormData) => {
    setLoading(true);
    setSubscriptionData(data);
    
    try {
      // In a real app, this might redirect to Stripe or call a server action
      // For now, we simulate success and move to clinic setup
      // TODO: Implement server action for subscription saving
      setTimeout(() => {
        setStep("clinic");
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
      setLoading(false);
    }
  };

  const handleClinicSubmit = async (data: ClinicFormData) => {
    setLoading(true);
    setClinicData(data);

    try {
      const res = await saveClinicStep(data, subscriptionData as SubscriptionFormData);
      if (res.error || !res.clinicId) {
        toast.error(res.error || "Failed to save clinic");
        return;
      }
      setClinicId(res.clinicId);
      setStep("branch");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSubmit = async (data: BranchFormData) => {
    if (!clinicId) {
      toast.error("Clinic ID is missing. Please try again.");
      return;
    }

    setLoading(true);
    setBranchData(data);

    try {
      const res = await saveBranchStep(data, clinicId);
      if (res.error) {
        toast.error(res.error);
        return;
      }

      clearOnboarding();
      toast.success("🎉 Clinic initialized successfully!");
      router.push("/admin");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToSubscription = () => {
    setStep("subscription");
  };

  const handleBackToClinic = () => {
    setStep("clinic");
  };

  if (initializing) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Simple step indicator */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {currentStep === "subscription" && "Step 1 of 3: Plan"}
          {currentStep === "clinic" && "Step 2 of 3: Clinic"}
          {currentStep === "branch" && "Step 3 of 3: Branch"}
        </span>
        <div className="flex gap-1">
          <div
            className={`h-1.5 w-4 rounded-full ${
              currentStep === "subscription" ? "bg-primary" : "bg-primary/30"
            }`}
          />
          <div
            className={`h-1.5 w-4 rounded-full ${
              currentStep === "clinic" ? "bg-primary" : currentStep === "branch" ? "bg-primary/30" : "bg-muted"
            }`}
          />
          <div
            className={`h-1.5 w-4 rounded-full ${
              currentStep === "branch" ? "bg-primary" : "bg-muted"
            }`}
          />
        </div>
      </div>

      {currentStep === "subscription" && (
        <SubscriptionSetupStep
          defaultValues={subscriptionData}
          onSubmit={handleSubscriptionSubmit}
          loading={loading}
        />
      )}

      {currentStep === "clinic" && (
        <ClinicSetupStep
          defaultValues={clinicData}
          onSubmit={handleClinicSubmit}
          onBack={handleBackToSubscription}
          loading={loading}
        />
      )}

      {currentStep === "branch" && (
        <BranchSetupStep
          defaultValues={branchData}
          onSubmit={handleBranchSubmit}
          onBack={handleBackToClinic}
          loading={loading}
        />
      )}
    </div>
  );
}
