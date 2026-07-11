import type { SyncDocType } from "./schema";

/**
 * Shared sync wire-types. Pure types (no runtime imports) so both the client
 * replication code and the server actions can depend on them without pulling
 * server-only modules into the browser bundle.
 */

// Compound (updated_at, id) checkpoint — stable across same-timestamp batches.
export interface SyncCheckpoint {
  id: string;
  updated_at: string;
}

export interface PullResult {
  documents: SyncDocType[];
  checkpoint: SyncCheckpoint | null;
}

// One entry of what RXDB sends to a push handler.
export interface PushRow {
  newDocumentState: SyncDocType;
  assumedMasterState?: SyncDocType | null;
}
