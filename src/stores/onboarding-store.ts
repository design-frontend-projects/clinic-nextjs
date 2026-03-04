import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ProfileFormData,
  ClinicFormData,
  OnboardingStep,
} from "@/types/onboarding.types";

type OnboardingState = {
  profileData: Partial<ProfileFormData>;
  clinicData: Partial<ClinicFormData>;
  currentStep: OnboardingStep;
  isComplete: boolean;
};

type OnboardingActions = {
  setProfileData: (data: Partial<ProfileFormData>) => void;
  setClinicData: (data: Partial<ClinicFormData>) => void;
  setStep: (step: OnboardingStep) => void;
  markComplete: () => void;
  clearOnboarding: () => void;
};

const initialState: OnboardingState = {
  profileData: {},
  clinicData: {},
  currentStep: "profile",
  isComplete: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>()(
  persist(
    (set) => ({
      ...initialState,

      setProfileData: (data) =>
        set((state) => ({
          profileData: { ...state.profileData, ...data },
        })),

      setClinicData: (data) =>
        set((state) => ({
          clinicData: { ...state.clinicData, ...data },
        })),

      setStep: (step) => set({ currentStep: step }),

      markComplete: () => set({ isComplete: true }),

      clearOnboarding: () => set(initialState),
    }),
    {
      name: "clinic-onboarding",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
