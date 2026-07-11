"use client";

import {
  replicateRxCollection,
  type RxReplicationState,
} from "rxdb/plugins/replication";
import type {
  RxCollection,
  ReplicationPullHandlerResult,
  WithDeleted,
} from "rxdb";
import type { Subject } from "rxjs";
import { pullChanges, pushChanges } from "@/app/actions/sync";
import { COLLECTIONS } from "./collection-registry";
import type { OfflineDatabase } from "./db";
import type { SyncDocType } from "./schema";
import type { PushRow, SyncCheckpoint } from "./sync-types";
import {
  createRealtimeStreams,
  type PullStreamItem,
} from "./realtime-stream";

type Checkpoint = SyncCheckpoint | null;

export interface CollectionReplication {
  name: string;
  state: RxReplicationState<SyncDocType, Checkpoint>;
}

export interface ReplicationHandle {
  replications: CollectionReplication[];
  cancel: () => Promise<void>;
}

function replicateCollection(
  collection: RxCollection<SyncDocType>,
  name: string,
  stream$: Subject<PullStreamItem>,
): RxReplicationState<SyncDocType, Checkpoint> {
  return replicateRxCollection<SyncDocType, Checkpoint>({
    collection,
    replicationIdentifier: `clinic-sync-${name}`,
    live: true,
    retryTime: 5000, // exponential-ish backoff between failed attempts
    waitForLeadership: true, // only the leader tab replicates
    autoStart: true,
    pull: {
      batchSize: 60,
      stream$: stream$.asObservable(),
      async handler(lastCheckpoint, batchSize) {
        const result = await pullChanges(name, lastCheckpoint ?? null, batchSize);
        return {
          documents: result.documents,
          checkpoint: result.checkpoint,
        } as ReplicationPullHandlerResult<SyncDocType, Checkpoint>;
      },
    },
    push: {
      batchSize: 40,
      async handler(rows) {
        const conflicts = await pushChanges(
          name,
          rows as unknown as PushRow[],
        );
        return conflicts as unknown as WithDeleted<SyncDocType>[];
      },
    },
  });
}

/**
 * Start live bi-directional replication for every synced collection, wiring each
 * to its Supabase Realtime change-feed. Returns a handle to tear everything down
 * on logout / tenant switch.
 */
export function initReplication(
  db: OfflineDatabase,
  clinicId: string,
): ReplicationHandle {
  const realtime = createRealtimeStreams(clinicId);
  const replications: CollectionReplication[] = [];

  for (const spec of COLLECTIONS) {
    const collection = db.collections[
      spec.name
    ] as unknown as RxCollection<SyncDocType>;
    const stream$ = realtime.streams.get(spec.name);
    if (!collection || !stream$) continue;
    replications.push({
      name: spec.name,
      state: replicateCollection(collection, spec.name, stream$),
    });
  }

  return {
    replications,
    cancel: async () => {
      await Promise.all(replications.map((r) => r.state.cancel()));
      realtime.cleanup();
    },
  };
}
