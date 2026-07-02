"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ProfileSetupStep } from "@/components/onboarding/profile-setup-step";
import { ClinicSetupStep } from "@/components/onboarding/clinic-setup-step";
import { BranchSetupStep } from "@/components/onboarding/branch-setup-step";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { saveProfileStep, saveClinicStep, saveBranchStep, getOnboardingProgress } from "@/app/actions/onboarding";
import type { ProfileFormData, ClinicFormData, BranchFormData } from "@/types/onboarding.types";
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
    profileData,
    clinicData,
    branchData,
    currentStep,
    clinicId,
    setProfileData,
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

        if (res.data?.profileData) setProfileData(res.data.profileData as any);
        if (res.data?.clinicData) setClinicData(res.data.clinicData as any);
        if (res.data?.branchData) setBranchData(res.data.branchData as any);
        if ((res.data as any)?.clinicId) setClinicId((res.data as any).clinicId);
        
        setStep(res.step as any);
      } catch (err) {
        console.error(err);
      } finally {
        setInitializing(false);
      }
    }
    loadProgress();
  }, [setProfileData, setClinicData, setBranchData, setStep, setClinicId, router]);

  const handleProfileSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    setProfileData(data);
    
    try {
      const res = await saveProfileStep(data);
      if (res.error) {
        toast.error(res.error);
        return;
      }
      setStep("clinic");
    } catch (err) {
      console.error(err);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleClinicSubmit = async (data: ClinicFormData) => {
    setLoading(true);
    setClinicData(data);

    try {
      const res = await saveClinicStep(data);
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

  const handleBackToProfile = () => {
    setStep("profile");
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
          {currentStep === "profile" && "Step 1 of 3: Profile"}
          {currentStep === "clinic" && "Step 2 of 3: Clinic"}
          {currentStep === "branch" && "Step 3 of 3: Branch"}
        </span>
        <div className="flex gap-1">
          <div
            className={`h-1.5 w-4 rounded-full ${
              currentStep === "profile" ? "bg-primary" : "bg-primary/30"
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

      {currentStep === "profile" && (
        <ProfileSetupStep
          defaultValues={{
            full_name: profileData.full_name || defaultFullName || "",
            email: profileData.email || defaultEmail || "",
            phone: profileData.phone || "",
            role: "owner",
            specialty: profileData.specialty || "",
          }}
          onSubmit={handleProfileSubmit}
          loading={loading}
        />
      )}

      {currentStep === "clinic" && (
        <ClinicSetupStep
          defaultValues={clinicData}
          onSubmit={handleClinicSubmit}
          onBack={handleBackToProfile}
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
