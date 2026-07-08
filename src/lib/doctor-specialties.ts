/**
 * Helpers for keeping the `doctor_specialties` junction in sync with a doctor's
 * selected specialties. The diff is a pure function so it can be unit-tested
 * without a database; the writer applies that diff inside any Prisma
 * client/transaction.
 */

export interface SpecialtyDiff {
  toAdd: string[];
  toRemove: string[];
}

/**
 * Compute which specialty links to create and which to delete to move from
 * `current` to `next`. Inputs are de-duplicated; order is not significant.
 */
export function diffSpecialtyIds(
  current: readonly string[],
  next: readonly string[],
): SpecialtyDiff {
  const currentSet = new Set(current);
  const nextSet = new Set(next);

  const toAdd = [...nextSet].filter((id) => !currentSet.has(id));
  const toRemove = [...currentSet].filter((id) => !nextSet.has(id));

  return { toAdd, toRemove };
}

/** Minimal Prisma surface needed to sync the junction (client or tx). */
export interface DoctorSpecialtiesClient {
  doctor_specialties: {
    findMany(args: {
      where: { profile_id: string };
      select: { specialty_id: true };
    }): Promise<{ specialty_id: string }[]>;
    createMany(args: {
      data: { profile_id: string; specialty_id: string }[];
      skipDuplicates?: boolean;
    }): Promise<unknown>;
    deleteMany(args: {
      where: { profile_id: string; specialty_id: { in: string[] } };
    }): Promise<unknown>;
  };
}

/**
 * Reconcile the junction rows for `profileId` so they match `specialtyIds`.
 * Idempotent: re-running with the same input is a no-op.
 */
export async function syncDoctorSpecialties(
  client: DoctorSpecialtiesClient,
  profileId: string,
  specialtyIds: readonly string[],
): Promise<SpecialtyDiff> {
  const existing = await client.doctor_specialties.findMany({
    where: { profile_id: profileId },
    select: { specialty_id: true },
  });

  const diff = diffSpecialtyIds(
    existing.map((row) => row.specialty_id),
    specialtyIds,
  );

  if (diff.toRemove.length > 0) {
    await client.doctor_specialties.deleteMany({
      where: { profile_id: profileId, specialty_id: { in: diff.toRemove } },
    });
  }

  if (diff.toAdd.length > 0) {
    await client.doctor_specialties.createMany({
      data: diff.toAdd.map((specialty_id) => ({
        profile_id: profileId,
        specialty_id,
      })),
      skipDuplicates: true,
    });
  }

  return diff;
}
