"use server";

import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";
import { revalidatePath } from "next/cache";

import { cookies } from "next/headers";

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

  const cookieStore = await cookies();
  cookieStore.set("active_branch_id", branchId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/");
}
