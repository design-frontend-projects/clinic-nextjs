"use client";

import { useState, useEffect } from "react";
import { useRouter } from "@/i18n/routing";
import { toast } from "sonner";
import { SubscriptionSetupStep } from "@/components/onboarding/subscription-setup-step";
import { ClinicSetupStep } from "@/components/onboarding/clinic-setup-step";
import { SpecialtySetupStep } from "@/components/onboarding/specialty-setup-step";
import { BranchSetupStep } from "@/components/onboarding/branch-setup-step";
import { useOnboardingStore } from "@/stores/onboarding-store";
import {
  saveClinicStep,
  saveBranchStep,
  saveSpecialtiesStep,
  getOnboardingProgress,
} from "@/app/actions/onboarding";
import type {
  ClinicFormData,
  BranchFormData,
  SubscriptionFormData,
  OnboardingStep,
} from "@/types/onboarding.types";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

type OnboardingProgressData = {
  subscriptionData?: Partial<SubscriptionFormData>;
  clinicData?: Partial<ClinicFormData>;
  branchData?: Partial<BranchFormData>;
  specialtyIds?: string[];
  clinicId?: string;
};

type OnboardingFormProps = {
  defaultEmail?: string;
  defaultFullName?: string;
  /** Plan chosen on the public pricing page; wins over any persisted value. */
  initialPlanId?: string;
};

export function OnboardingForm({
  defaultEmail,
  defaultFullName,
  initialPlanId,
}: OnboardingFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const t = useTranslations("auth.onboarding");

  const {
    subscriptionData,
    clinicData,
    branchData,
    specialtyIds,
    currentStep,
    clinicId,
    setSubscriptionData,
    setClinicData,
    setBranchData,
    setSpecialtyIds,
    setStep,
    setClinicId,
    clearOnboarding,
  } = useOnboardingStore();

  useEffect(() => {
    async function loadProgress() {
      try {
        const res = await getOnboardingProgress();
        if ("error" in res) {
          toast.error(t("failedToLoad"));
          return;
        }

        if (res.step === "completed") {
          router.push("/admin");
          return;
        }

        if ("data" in res && res.data) {
          const data = res.data as OnboardingProgressData;
          if (data.subscriptionData) setSubscriptionData(data.subscriptionData);
          if (data.clinicData) setClinicData(data.clinicData);
          if (data.branchData) setBranchData(data.branchData);
          if (data.specialtyIds) setSpecialtyIds(data.specialtyIds);
          if (data.clinicId) setClinicId(data.clinicId);
        }

        // The plan picked on the public pricing page overrides anything
        // persisted locally or restored from the server.
        if (initialPlanId) {
          setSubscriptionData({ plan_id: initialPlanId });
        }

        setStep(res.step as OnboardingStep);
      } catch (err) {
        console.error(err);
      } finally {
        setInitializing(false);
      }
    }
    loadProgress();
  }, [setSubscriptionData, setClinicData, setBranchData, setSpecialtyIds, setStep, setClinicId, router, initialPlanId]);

  const handleSubscriptionSubmit = async (data: SubscriptionFormData) => {
    setLoading(true);
    setSubscriptionData(data);
    
    try {
      setTimeout(() => {
        setStep("clinic");
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      toast.error(t("anErrorOccurred"));
      setLoading(false);
    }
  };

  const handleClinicSubmit = async (data: ClinicFormData) => {
    setLoading(true);
    setClinicData(data);

    try {
      const res = await saveClinicStep(data, subscriptionData as SubscriptionFormData);
      if (res.error || !res.clinicId) {
        toast.error(res.error || t("failedToSaveClinic"));
        return;
      }
      setClinicId(res.clinicId);
      setStep("specialties");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialtiesSubmit = async (ids: string[]) => {
    setLoading(true);
    setSpecialtyIds(ids);

    try {
      const res = await saveSpecialtiesStep(ids);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStep("branch");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(t("somethingWentWrong"));
    } finally {
      setLoading(false);
    }
  };

  const handleBranchSubmit = async (data: BranchFormData) => {
    if (!clinicId) {
      toast.error(t("missingClinicId"));
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
      toast.success(t("setupCompleted"));
      router.push("/admin");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error(t("somethingWentWrong"));
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

  const handleBackToSpecialties = () => {
    setStep("specialties");
  };

  const STEP_ORDER = ["subscription", "clinic", "specialties", "branch"] as const;
  const activeIndex = STEP_ORDER.indexOf(
    currentStep as (typeof STEP_ORDER)[number],
  );

  if (initializing) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {currentStep === "subscription" && t("step1")}
          {currentStep === "clinic" && t("step2")}
          {currentStep === "specialties" && t("step3")}
          {currentStep === "branch" && t("step4")}
        </span>
        <div className="flex gap-1">
          {STEP_ORDER.map((step, i) => (
            <div
              key={step}
              className={`h-1.5 w-4 rounded-full ${
                i === activeIndex
                  ? "bg-primary"
                  : i < activeIndex
                    ? "bg-primary/30"
                    : "bg-muted"
              }`}
            />
          ))}
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

      {currentStep === "specialties" && (
        <SpecialtySetupStep
          defaultValues={specialtyIds}
          onSubmit={handleSpecialtiesSubmit}
          onBack={handleBackToClinic}
          loading={loading}
        />
      )}

      {currentStep === "branch" && (
        <BranchSetupStep
          defaultValues={branchData}
          onSubmit={handleBranchSubmit}
          onBack={handleBackToSpecialties}
          loading={loading}
        />
      )}
    </div>
  );
}