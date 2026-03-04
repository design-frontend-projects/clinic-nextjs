"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function updateProfileBranch(branchId: string) {
  const tenant = await requireTenantInfo();

  // Verify the branch belongs to the user's clinic
  const branch = await prisma.branches.findFirst({
    where: {
      id: branchId,
      clinic_id: tenant.clinicId,
    },
  });

  if (!branch) {
    throw new Error("Invalid branch for this clinic");
  }

  await prisma.profiles.update({
    where: { id: tenant.profileId },
    data: { branch_id: branchId },
  });

  revalidatePath("/");
}
