"use server";

import { requireTenantInfo } from "@/lib/auth";
import { COLLECTION_BY_NAME } from "@/lib/offline/collection-registry";
import {
  pullChangesForClinic,
  pushChangesForClinic,
  type PullResult,
  type PushRow,
  type SyncCheckpoint,
} from "@/lib/offline/sync-server/pull-push";
import type { SyncDocType } from "@/lib/offline/schema";

function specOrThrow(collection: string) {
  const spec = COLLECTION_BY_NAME.get(collection);
  if (!spec) throw new Error(`Unknown sync collection: ${collection}`);
  return spec;
}

/** RXDB pull handler backend — see replicateRxCollection in replication.ts. */
export async function pullChanges(
  collection: string,
  checkpoint: SyncCheckpoint | null,
  batchSize: number,
): Promise<PullResult> {
  const spec = specOrThrow(collection);
  const tenant = await requireTenantInfo();
  return pullChangesForClinic(spec, tenant.clinicId, checkpoint, batchSize);
}

/** RXDB push handler backend — returns conflicting master docs (LWW). */
export async function pushChanges(
  collection: string,
  rows: PushRow[],
): Promise<SyncDocType[]> {
  const spec = specOrThrow(collection);
  const tenant = await requireTenantInfo();
  return pushChangesForClinic(
    spec,
    tenant.clinicId,
    tenant.branchId ?? null,
    rows,
  );
}
