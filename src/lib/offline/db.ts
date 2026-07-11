"use client";

import {
  addRxPlugin,
  createRxDatabase,
  type RxDatabase,
  type RxStorage,
} from "rxdb";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { RxDBLeaderElectionPlugin } from "rxdb/plugins/leader-election";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { RxDBUpdatePlugin } from "rxdb/plugins/update";
import { wrappedKeyEncryptionCryptoJsStorage } from "rxdb/plugins/encryption-crypto-js";
import { buildCollectionsInput } from "./collections";

export type OfflineDatabase = RxDatabase;

let pluginsReady = false;

async function ensurePlugins(): Promise<void> {
  if (pluginsReady) return;
  pluginsReady = true;
  addRxPlugin(RxDBLeaderElectionPlugin); // only the leader tab replicates
  addRxPlugin(RxDBMigrationSchemaPlugin);
  addRxPlugin(RxDBUpdatePlugin);
  if (process.env.NODE_ENV !== "production") {
    const { RxDBDevModePlugin } = await import("rxdb/plugins/dev-mode");
    addRxPlugin(RxDBDevModePlugin);
  }
}

// RXDB DB names allow [a-z][_$a-zA-Z0-9-]* — UUID characters qualify. Namespaced
// per clinic so switching tenants opens a distinct IndexedDB (no leakage on a
// shared device).
function dbNameFor(clinicId: string): string {
  return `clinicdb_${clinicId.toLowerCase()}`;
}

let current: { clinicId: string; db: OfflineDatabase } | null = null;
let creating: Promise<OfflineDatabase> | null = null;

// The dev-mode plugin (see ensurePlugins) rejects any storage whose outermost
// wrapper is not a schema validator (RxDB error DVM1), so in dev the chain is
// validator → encryption → dexie. Validation runs on plain documents before
// field encryption. The validator is dynamically imported to keep ajv out of
// the production bundle.
async function buildStorage(): Promise<RxStorage<unknown, unknown>> {
  const storage = wrappedKeyEncryptionCryptoJsStorage({
    storage: getRxStorageDexie(),
  });
  if (process.env.NODE_ENV === "production") return storage;
  const { wrappedValidateAjvStorage } = await import(
    "rxdb/plugins/validate-ajv"
  );
  return wrappedValidateAjvStorage({ storage });
}

/**
 * Lazily create (or return) the per-clinic RxDatabase. Switching clinicId closes
 * the previous database first. `password` encrypts the at-rest sensitive fields
 * (see collection-registry `encrypted`) — derive it per session from a
 * post-auth secret; do NOT hardcode a static key.
 */
export async function getOfflineDb(
  clinicId: string,
  password: string,
): Promise<OfflineDatabase> {
  if (current && current.clinicId === clinicId) return current.db;
  if (current && current.clinicId !== clinicId) {
    await destroyOfflineDb();
  }
  if (creating) return creating;

  creating = (async () => {
    await ensurePlugins();
    const storage = await buildStorage();
    const db = await createRxDatabase({
      name: dbNameFor(clinicId),
      storage,
      password,
      multiInstance: true,
      eventReduce: true,
      // tolerate HMR re-creating the same-named DB in dev
      ignoreDuplicate: process.env.NODE_ENV !== "production",
    });
    await db.addCollections(buildCollectionsInput());
    current = { clinicId, db };
    creating = null;
    return db;
  })();

  return creating;
}

export async function destroyOfflineDb(): Promise<void> {
  if (current) {
    const { db } = current;
    current = null;
    await db.close();
  }
}

export function getCurrentOfflineDb(): OfflineDatabase | null {
  return current?.db ?? null;
}
