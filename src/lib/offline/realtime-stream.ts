"use client";

import { Subject } from "rxjs";
import type { RxReplicationPullStreamItem } from "rxdb";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createSupabaseClient } from "@/lib/supabase/client";
import { COLLECTIONS } from "./collection-registry";
import type { SyncDocType } from "./schema";
import type { SyncCheckpoint } from "./sync-types";

export type PullStreamItem = RxReplicationPullStreamItem<
  SyncDocType,
  SyncCheckpoint | null
>;

export interface RealtimeStreams {
  streams: Map<string, Subject<PullStreamItem>>;
  cleanup: () => void;
}

/**
 * One Supabase Realtime channel per synced table, filtered to this clinic. Any
 * INSERT/UPDATE/DELETE emits the 'RESYNC' token into that collection's stream,
 * prompting RXDB to re-run its pull handler from the last checkpoint.
 *
 * Requires the migration-14 RLS SELECT policies: the authenticated browser only
 * receives change events for rows its clinic owns.
 */
export function createRealtimeStreams(clinicId: string): RealtimeStreams {
  const supabase = createSupabaseClient();
  const streams = new Map<string, Subject<PullStreamItem>>();
  const channels: RealtimeChannel[] = [];

  for (const spec of COLLECTIONS) {
    const subject = new Subject<PullStreamItem>();
    streams.set(spec.name, subject);

    const channel = supabase
      .channel(`sync:${spec.name}:${clinicId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: spec.name,
          filter: `clinic_id=eq.${clinicId}`,
        },
        () => subject.next("RESYNC"),
      )
      .subscribe();

    channels.push(channel);
  }

  return {
    streams,
    cleanup: () => {
      for (const channel of channels) supabase.removeChannel(channel);
      for (const subject of streams.values()) subject.complete();
    },
  };
}
