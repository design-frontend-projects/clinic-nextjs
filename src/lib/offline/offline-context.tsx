"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import type { Subscription } from "rxjs";
import type { OfflineDatabase } from "./db";
import type { ReplicationHandle } from "./replication";
import { conflictEvents$ } from "./conflict-handler";
import { useOnlineStore } from "@/stores/online-store";

interface OfflineContextValue {
  db: OfflineDatabase | null;
  ready: boolean;
}

const OfflineContext = createContext<OfflineContextValue>({
  db: null,
  ready: false,
});

export function useOfflineDb(): OfflineDatabase | null {
  return useContext(OfflineContext).db;
}

export function useOfflineReady(): boolean {
  return useContext(OfflineContext).ready;
}

interface OfflineProviderProps {
  clinicId: string;
  userId: string;
  children: React.ReactNode;
}

/**
 * Initialises the per-clinic RXDB database and starts live replication for the
 * authenticated tenant. Mount inside the dashboard, below auth resolution.
 *
 * Encryption note: the at-rest key is derived from the (clinicId, userId) pair
 * so it is stable across sessions. This is deliberately weak — the key is
 * derivable client-side — and only obfuscates data at rest. A hardware-backed or
 * server-issued key would be stronger; tracked as a hardening follow-up.
 */
export function OfflineProvider({
  clinicId,
  userId,
  children,
}: OfflineProviderProps) {
  const [db, setDb] = useState<OfflineDatabase | null>(null);
  const [ready, setReady] = useState(false);
  const handleRef = useRef<ReplicationHandle | null>(null);
  const setSyncing = useOnlineStore((state) => state.setSyncing);
  const setSyncError = useOnlineStore((state) => state.setSyncError);
  const t = useTranslations("offline");

  useEffect(() => {
    let cancelled = false;
    const subs: Subscription[] = [];
    const activeCollections = new Set<string>();

    void (async () => {
      // Dynamically imported so RXDB (which touches browser globals) never loads
      // during SSR of this client component, and stays out of non-dashboard bundles.
      const { getOfflineDb } = await import("./db");
      const { initReplication } = await import("./replication");

      const password = `${clinicId}:${userId}`;
      const database = await getOfflineDb(clinicId, password);
      if (cancelled) {
        return;
      }
      setDb(database);

      const handle = initReplication(database, clinicId);
      handleRef.current = handle;

      for (const { name, state } of handle.replications) {
        subs.push(
          state.active$.subscribe((active) => {
            if (active) activeCollections.add(name);
            else activeCollections.delete(name);
            setSyncing(activeCollections.size > 0);
          }),
        );
        subs.push(
          state.error$.subscribe((error) => {
            // Offline errors are expected and noisy — record, don't toast.
            setSyncError(error?.message ?? "sync error");
          }),
        );
      }

      subs.push(
        conflictEvents$.subscribe(() => {
          toast.info(t("conflictKept"));
        }),
      );

      setReady(true);
    })();

    return () => {
      cancelled = true;
      subs.forEach((sub) => sub.unsubscribe());
      const handle = handleRef.current;
      handleRef.current = null;
      setReady(false);
      setDb(null);
      if (handle) void handle.cancel();
      void import("./db").then(({ destroyOfflineDb }) => destroyOfflineDb());
    };
  }, [clinicId, userId, setSyncing, setSyncError, t]);

  return (
    <OfflineContext.Provider value={{ db, ready }}>
      {children}
    </OfflineContext.Provider>
  );
}
