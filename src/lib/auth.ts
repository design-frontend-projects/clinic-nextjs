import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export type TenantInfo = {
  userId: string;
  profileId: string;
  clinicId: string;
  branchId: string | null;
  role: string | null;
};

export async function getTenantInfo(): Promise<TenantInfo | null> {
  const { userId } = await auth();
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
  return tenant;
}
