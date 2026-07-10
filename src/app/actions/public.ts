"use server";

import { getPublicPlans } from "@/lib/public-data";
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
