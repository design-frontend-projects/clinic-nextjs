import { Subject } from "rxjs";
import type { RxConflictHandler } from "rxdb";
import type { SyncDocType } from "./schema";

/**
 * Emits whenever a conflict was resolved in the server's favour (a local edit
 * was discarded). The OfflineProvider subscribes to surface a non-blocking toast.
 */
export const conflictEvents$ = new Subject<{ serverWon: boolean }>();

function updatedAtOf(doc: Record<string, unknown>): string {
  return typeof doc.updated_at === "string" ? doc.updated_at : "";
}

/**
 * Last-write-wins conflict handler, server-authoritative on ties.
 *
 * When the same record was changed both locally and on the server, the version
 * with the greater `updated_at` wins; equal timestamps resolve to the server
 * (realMasterState). Combined with the server push handler — which also rejects
 * stale client writes by returning the master doc — this gives a consistent
 * "server wins unless the client is strictly newer" policy.
 */
export const lwwConflictHandler: RxConflictHandler<SyncDocType> = {
  isEqual: (a, b) =>
    a.id === b.id &&
    Boolean(a._deleted) === Boolean(b._deleted) &&
    updatedAtOf(a) === updatedAtOf(b),

  resolve: async ({ realMasterState, newDocumentState }) => {
    const serverWins =
      updatedAtOf(newDocumentState) <= updatedAtOf(realMasterState);
    if (serverWins) conflictEvents$.next({ serverWon: true });
    return serverWins ? realMasterState : newDocumentState;
  },
};
