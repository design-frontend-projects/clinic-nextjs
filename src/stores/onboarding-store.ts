import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  ProfileFormData,
  ClinicFormData,
  BranchFormData,
  SubscriptionFormData,
  OnboardingStep,
} from "@/types/onboarding.types";

type OnboardingState = {
  profileData: Partial<ProfileFormData>;
  clinicData: Partial<ClinicFormData>;
  branchData: Partial<BranchFormData>;
  subscriptionData: Partial<SubscriptionFormData>;
  currentStep: OnboardingStep;
  clinicId: string | null;
  isComplete: boolean;
};

type OnboardingActions = {
  setProfileData: (data: Partial<ProfileFormData>) => void;
  setClinicData: (data: Partial<ClinicFormData>) => void;
  setBranchData: (data: Partial<BranchFormData>) => void;
  setSubscriptionData: (data: Partial<SubscriptionFormData>) => void;
  setStep: (step: OnboardingStep) => void;
  setClinicId: (id: string) => void;
  markComplete: () => void;
  clearOnboarding: () => void;
};

const initialState: OnboardingState = {
  profileData: {},
  clinicData: {},
  branchData: {},
  subscriptionData: {},
  currentStep: "subscription",
  clinicId: null,
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

      setBranchData: (data) =>
        set((state) => ({
          branchData: { ...state.branchData, ...data },
        })),

      setSubscriptionData: (data) =>
        set((state) => ({
          subscriptionData: { ...state.subscriptionData, ...data },
        })),

      setStep: (step) => set({ currentStep: step }),

      setClinicId: (id) => set({ clinicId: id }),

      markComplete: () => set({ isComplete: true }),

      clearOnboarding: () => set(initialState),
    }),
    {
      name: "clinic-onboarding",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
