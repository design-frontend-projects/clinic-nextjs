import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type TenantInfo = {
  userId: string;
  orgId: string | null;
  profileId: string;
  clinicId: string;
  branchId: string | null;
  role: string | null;
};

export async function getTenantInfo(): Promise<TenantInfo | null> {
  const { userId, orgId } = await auth();
  if (!userId) return null;

  const profile = await prisma.profiles.findFirst({
    where: { clerk_user_id: userId },
    select: {
      id: true,
      clinic_id: true,
      branch_id: true,
      role: true,
    },
  });

  if (!profile) return null;

  return {
    userId,
    orgId: orgId ?? null,
    profileId: profile.id,
    clinicId: profile.clinic_id,
    branchId: profile.branch_id,
    role: profile.role,
  };
}

export async function requireTenantInfo(): Promise<TenantInfo> {
  const tenant = await getTenantInfo();
  if (!tenant) {
    throw new Error("Unauthorized: No tenant info found");
  }
  if (!tenant.clinicId) {
    throw new Error(
      "Configuration Error: The logged-in user's profile does not have an assigned clinic_id. Please ensure your profile is linked to a clinic.",
    );
  }
  return tenant;
}
