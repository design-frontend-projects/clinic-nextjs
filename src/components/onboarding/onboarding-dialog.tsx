"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, UserCircle } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProfileSetupStep } from "./profile-setup-step";
import { ClinicSetupStep } from "./clinic-setup-step";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { createClinic, createProfile } from "@/app/actions/onboarding";
import type { ProfileFormData, ClinicFormData } from "@/types/onboarding.types";

type OnboardingDialogProps = {
  open: boolean;
  defaultEmail?: string;
  defaultFullName?: string;
};

const stepConfig = {
  profile: {
    title: "Complete Your Profile",
    description: "Tell us about yourself to personalize your experience.",
    icon: UserCircle,
    label: "Step 1 of 2",
  },
  clinic: {
    title: "Set Up Your Clinic",
    description: "Create your first clinic workspace. You can add more later.",
    icon: Building2,
    label: "Step 2 of 2",
  },
} as const;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

export function OnboardingDialog({
  open,
  defaultEmail,
  defaultFullName,
}: OnboardingDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState(1);

  const {
    profileData,
    clinicData,
    currentStep,
    setProfileData,
    setClinicData,
    setStep,
    clearOnboarding,
  } = useOnboardingStore();

  const config = stepConfig[currentStep];
  const StepIcon = config.icon;

  const handleProfileSubmit = (data: ProfileFormData) => {
    setProfileData(data);
    setDirection(1);
    setStep("clinic");
  };

  const handleClinicSubmit = async (data: ClinicFormData) => {
    setLoading(true);
    setClinicData(data);

    try {
      // 1. Create clinic
      const clinicRes = await createClinic(data);
      if (clinicRes.error || !clinicRes.clinicId) {
        toast.error(clinicRes.error || "Failed to create clinic");
        return;
      }

      // 2. Create profile linked to clinic
      const storedProfile = useOnboardingStore.getState().profileData;
      const profileRes = await createProfile({
        full_name: storedProfile.full_name || defaultFullName || "Admin",
        email: storedProfile.email || defaultEmail || "",
        phone: storedProfile.phone,
        role: storedProfile.role || "admin",
        specialty: storedProfile.specialty,
        clinicId: clinicRes.clinicId,
      });

      if (profileRes.error) {
        toast.error(profileRes.error);
        return;
      }

      // 3. Cache profile in sessionStorage for quick dashboard access
      sessionStorage.setItem(
        "clinic-profile",
        JSON.stringify({
          profileId: profileRes.profileId,
          clinicId: clinicRes.clinicId,
          role: storedProfile.role || "admin",
          fullName: storedProfile.full_name || defaultFullName,
          email: storedProfile.email || defaultEmail,
        }),
      );

      // 4. Cleanup onboarding store & redirect
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

  const handleBack = () => {
    setDirection(-1);
    setStep("profile");
  };

  return (
    <Dialog open={open} modal>
      <DialogContent
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        className="sm:max-w-[520px]"
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <StepIcon className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              {config.label}
            </span>
          </div>
          {/* Step dots */}
          <div className="flex gap-1.5">
            <div
              className={`h-2 w-8 rounded-full transition-colors ${
                currentStep === "profile" ? "bg-primary" : "bg-primary/30"
              }`}
            />
            <div
              className={`h-2 w-8 rounded-full transition-colors ${
                currentStep === "clinic" ? "bg-primary" : "bg-muted"
              }`}
            />
          </div>
        </div>

        <DialogHeader>
          <DialogTitle>{config.title}</DialogTitle>
          <DialogDescription>{config.description}</DialogDescription>
        </DialogHeader>

        {/* Animated Step Content */}
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={currentStep}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {currentStep === "profile" && (
              <ProfileSetupStep
                defaultValues={{
                  full_name: profileData.full_name || defaultFullName || "",
                  email: profileData.email || defaultEmail || "",
                  phone: profileData.phone || "",
                  role: "admin",
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
                onBack={handleBack}
                loading={loading}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
