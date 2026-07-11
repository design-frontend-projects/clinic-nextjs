"use client";

import { useEffect, useState } from "react";
import type { RxCollection } from "rxdb";
import { useOfflineDb } from "@/lib/offline/offline-context";
import type { SyncDocType } from "@/lib/offline/schema";

export interface UseOfflineCollectionResult<T> {
  docs: T[];
  isLoading: boolean;
}

/**
 * Reactive read of a synced RXDB collection. Returns the live (non-deleted)
 * documents for the current clinic and re-renders on every local or replicated
 * change. RXDB excludes tombstoned (`_deleted`) docs from queries automatically.
 *
 * This is the local-first data source; components can swap their existing
 * TanStack Query read for this hook to become offline-capable.
 */
export function useOfflineCollection<T = SyncDocType>(
  name: string,
  selector: Record<string, unknown> = {},
): UseOfflineCollectionResult<T> {
  const db = useOfflineDb();
  const [docs, setDocs] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Serialise the selector so the effect re-subscribes when its shape changes.
  const selectorKey = JSON.stringify(selector);

  useEffect(() => {
    if (!db) return;
    const collection = db.collections[name] as unknown as
      | RxCollection<SyncDocType>
      | undefined;
    if (!collection) return;

    // setState only from the subscription callback (external system), never
    // synchronously in the effect body — avoids cascading renders.
    const query = collection.find({ selector: JSON.parse(selectorKey) });
    const sub = query.$.subscribe((results) => {
      setDocs(results.map((doc) => doc.toJSON() as unknown as T));
      setIsLoading(false);
    });

    return () => sub.unsubscribe();
  }, [db, name, selectorKey]);

  return { docs, isLoading };
}
