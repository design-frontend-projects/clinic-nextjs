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

export const DEFAULT_REALTIME_DEBOUNCE_MS = 500;

/**
 * One Supabase Realtime channel per synced table, filtered to this clinic. Any
 * INSERT/UPDATE/DELETE emits a debounced 'RESYNC' token into that collection's
 * stream, prompting RXDB to re-run its pull handler from the last checkpoint
 * without triggering bursts during bulk edits.
 *
 * Requires the migration-14 RLS SELECT policies: the authenticated browser only
 * receives change events for rows its clinic owns.
 */
export function createRealtimeStreams(
  clinicId: string,
  debounceMs = DEFAULT_REALTIME_DEBOUNCE_MS,
): RealtimeStreams {
  const supabase = createSupabaseClient();
  const streams = new Map<string, Subject<PullStreamItem>>();
  const channels: RealtimeChannel[] = [];
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  for (const spec of COLLECTIONS) {
    const subject = new Subject<PullStreamItem>();
    streams.set(spec.name, subject);

    const triggerDebouncedResync = () => {
      const existing = timers.get(spec.name);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        timers.delete(spec.name);
        subject.next("RESYNC");
      }, debounceMs);
      timers.set(spec.name, timer);
    };

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
        triggerDebouncedResync,
      )
      .subscribe();

    channels.push(channel);
  }

  return {
    streams,
    cleanup: () => {
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
      for (const channel of channels) supabase.removeChannel(channel);
      for (const subject of streams.values()) subject.complete();
    },
  };
}
