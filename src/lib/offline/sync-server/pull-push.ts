import { prismaBase } from "@/lib/prisma";
import {
  allFields,
  type CollectionSpec,
} from "@/lib/offline/collection-registry";
import type { SyncDocType } from "@/lib/offline/schema";
import type {
  PullResult,
  PushRow,
  SyncCheckpoint,
} from "@/lib/offline/sync-types";
import {
  fromRxDoc,
  toRxDoc,
  updatedAtIso,
  type ServerRow,
} from "@/lib/offline/mappers";

export type { PullResult, PushRow, SyncCheckpoint };

// Minimal structural view of the Prisma delegate we drive dynamically by model
// name. The app's queries stay fully typed; only this generic sync path is loose.
interface SyncUpsertArgs {
  where: Record<string, unknown>;
  create: Record<string, unknown>;
  update: Record<string, unknown>;
  select?: Record<string, boolean>;
}

interface SyncDelegate {
  findMany(args: {
    where?: Record<string, unknown>;
    select?: Record<string, boolean>;
    orderBy?: unknown;
    take?: number;
  }): Promise<ServerRow[]>;
  upsert(args: SyncUpsertArgs): Promise<ServerRow>;
}

interface SyncTransactionRunner {
  $transaction(operations: Promise<unknown>[]): Promise<unknown[]>;
}

const PUSH_TRANSACTION_CHUNK_SIZE = 50;

// NOTE: prismaBase deliberately bypasses the soft-delete filter — the PULL must
// see tombstoned (deleted_at != null) rows to propagate deletes to clients.
function delegateFor(name: string): SyncDelegate {
  const delegate = (prismaBase as unknown as Record<string, SyncDelegate>)[name];
  if (!delegate) throw new Error(`No Prisma delegate for sync model: ${name}`);
  return delegate;
}

/**
 * Project Prisma queries strictly onto the collection's synced fields +
 * `deleted_at` so server-only schema additions never break offline replication.
 */
export function buildSyncSelect(spec: CollectionSpec): Record<string, true> {
  const select: Record<string, true> = { deleted_at: true };
  for (const field of Object.keys(allFields(spec))) {
    select[field] = true;
  }
  return select;
}

/**
 * PULL: rows in this clinic changed after `checkpoint`, tombstones included,
 * ordered by (updated_at, id) so the returned checkpoint is resumable.
 */
export async function pullChangesForClinic(
  spec: CollectionSpec,
  clinicId: string,
  checkpoint: SyncCheckpoint | null,
  batchSize: number,
): Promise<PullResult> {
  const delegate = delegateFor(spec.name);
  const select = buildSyncSelect(spec);

  const where: Record<string, unknown> = { clinic_id: clinicId };
  if (checkpoint) {
    const cp = new Date(checkpoint.updated_at);
    where.OR = [
      { updated_at: { gt: cp } },
      { updated_at: cp, id: { gt: checkpoint.id } },
    ];
  }

  const rows = await delegate.findMany({
    where,
    select,
    orderBy: [{ updated_at: "asc" }, { id: "asc" }],
    take: batchSize,
  });

  const documents = rows.map((row) => toRxDoc(spec, row));
  const last = rows[rows.length - 1];
  const nextCheckpoint = last
    ? { id: String(last.id), updated_at: updatedAtIso(last) }
    : checkpoint;

  return { documents, checkpoint: nextCheckpoint };
}

/**
 * PUSH (server-authoritative, last-write-wins): apply each client change unless
 * the server row moved since the client last saw it — those are returned as
 * conflicts (the current master doc) for RXDB to reconcile. clinic_id is always
 * stamped from the authenticated tenant, never trusted from the client.
 * Idempotent: writes are `upsert` keyed on the client-generated UUID.
 */
export async function pushChangesForClinic(
  spec: CollectionSpec,
  clinicId: string,
  branchId: string | null,
  rows: PushRow[],
): Promise<SyncDocType[]> {
  if (rows.length === 0) return [];

  const delegate = delegateFor(spec.name);
  const select = buildSyncSelect(spec);
  const hasBranch = "branch_id" in allFields(spec);
  const conflicts: SyncDocType[] = [];

  // Single batched lookup instead of N sequential findFirst queries.
  const ids = Array.from(
    new Set(rows.map((change) => String(change.newDocumentState.id))),
  );
  const existingRows = await delegate.findMany({
    where: { clinic_id: clinicId, id: { in: ids } },
    select,
  });
  const existingById = new Map<string, ServerRow>();
  for (const row of existingRows) {
    existingById.set(String(row.id), row);
  }

  const writes: SyncUpsertArgs[] = [];

  for (const change of rows) {
    const newState = change.newDocumentState;
    const assumed = change.assumedMasterState ?? null;
    const id = String(newState.id);

    const current = existingById.get(id);
    if (current) {
      const serverUpdated = updatedAtIso(current);
      const assumedUpdated =
        assumed && typeof assumed.updated_at === "string"
          ? assumed.updated_at
          : null;
      // Server changed since the client's assumed base → server wins (LWW).
      if (!assumedUpdated || serverUpdated > assumedUpdated) {
        conflicts.push(toRxDoc(spec, current));
        continue;
      }
    }

    const { data, deleted } = fromRxDoc(spec, newState);

    const createData: Record<string, unknown> = {
      ...data,
      id,
      clinic_id: clinicId, // tenant-stamped, never from client
    };
    if (hasBranch && createData.branch_id == null && branchId) {
      createData.branch_id = branchId;
    }
    if (deleted) createData.deleted_at = new Date();

    // clinic_id intentionally omitted from `update` — a record never changes tenant.
    const updateData: Record<string, unknown> = { ...data };
    delete updateData.clinic_id;

    writes.push({
      where: { id },
      create: createData,
      update: updateData,
      select: { id: true },
    });

    // Track the latest timestamp in-batch so duplicate IDs within one push
    // array don't conflict against an older snapshot.
    if (typeof newState.updated_at === "string") {
      existingById.set(id, {
        ...(current ?? {}),
        ...createData,
        id,
        clinic_id: clinicId,
        updated_at: new Date(newState.updated_at),
        deleted_at: deleted ? new Date() : null,
      });
    }
  }

  if (writes.length > 0) {
    const txRunner = prismaBase as unknown as SyncTransactionRunner;
    for (let i = 0; i < writes.length; i += PUSH_TRANSACTION_CHUNK_SIZE) {
      const chunk = writes.slice(i, i + PUSH_TRANSACTION_CHUNK_SIZE);
      await txRunner.$transaction(chunk.map((args) => delegate.upsert(args)));
    }
  }

  return conflicts;
}
