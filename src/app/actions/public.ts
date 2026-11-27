"use server";

import {
  getAllPublicActiveSpecialties,
  getPublicPlans,
  type PublicSelectableSpecialty,
} from "@/lib/public-data";
import type { PublicPlan } from "@/types/subscription.types";

/**
 * Unauthenticated read used by client components (onboarding plan picker).
 * Exposes only the whitelisted public plan fields; never throws.
 */
export async function getPublicPlansAction(): Promise<PublicPlan[]> {
  try {
    return await getPublicPlans();
  } catch (error) {
    console.error("[public] getPublicPlansAction failed", error);
    return [];
  }
}

/**
 * Unauthenticated read used by `/sign-up` so clinic owners can choose their
 * primary clinic specialty from the active global catalog.
 */
export async function getPublicSpecialtiesAction(): Promise<
  PublicSelectableSpecialty[]
> {
  try {
    return await getAllPublicActiveSpecialties();
  } catch (error) {
    console.error("[public] getPublicSpecialtiesAction failed", error);
    return [];
  }
}
