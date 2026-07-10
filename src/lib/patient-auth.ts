import { prisma } from "@/lib/prisma";
import { requireTenantInfo } from "@/lib/auth";

/**
 * Resolve the currently authenticated user's own patient record, scoped to
 * their tenant. Throws if the caller is not a patient with a linked record.
 */
export async function requireCurrentPatient() {
  const tenant = await requireTenantInfo();

  const patient = await prisma.patients.findFirst({
    where: { profile_id: tenant.profileId, clinic_id: tenant.clinicId },
  });

  if (!patient) {
    throw new Error("No patient record is linked to your account.");
  }

  return { tenant, patient };
}
