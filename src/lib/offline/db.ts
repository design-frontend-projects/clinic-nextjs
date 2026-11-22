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

const DEXIE_PREFIX = "rxdb-dexie-";

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

/**
 * RXDB DB names allow `[a-z][_$a-z0-9-]*` — UUID characters qualify.
 * Namespaced per `(clinicId, userId)` so both tenant switches AND multi-user
 * logins within the same clinic on a shared browser open distinct IndexedDBs
 * with matching encryption passwords (avoiding RxError DB1).
 */
export function dbNameFor(clinicId: string, userId: string): string {
  return `clinicdb_${clinicId.toLowerCase()}_${userId.toLowerCase()}`;
}

/**
 * Dexie IndexedDB prefix used by the legacy clinic-only database name
 * (`clinicdb_<clinicId>`). The trailing `--` guarantees this only matches
 * legacy databases (`rxdb-dexie-clinicdb_<clinicId>--<v>--<col>`) and never
 * matches per-user databases (`rxdb-dexie-clinicdb_<clinicId>_<userId>--...`).
 */
export function legacyDbPrefixFor(clinicId: string): string {
  return `${DEXIE_PREFIX}clinicdb_${clinicId.toLowerCase()}--`;
}

function dexieDbPrefixForName(dbName: string): string {
  return `${DEXIE_PREFIX}${dbName}--`;
}

function isRxDbPasswordMismatchError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: unknown; rxdb?: unknown };
  return err.code === "DB1";
}

async function deleteIndexedDbsByPrefix(prefix: string): Promise<string[]> {
  const idb = globalThis.indexedDB;
  if (!idb || typeof idb.databases !== "function") {
    return [];
  }

  const deleted: string[] = [];
  try {
    const databases = await idb.databases();
    const matchingNames = databases
      .map((info) => info.name)
      .filter(
        (name): name is string =>
          typeof name === "string" && name.startsWith(prefix),
      );

    await Promise.all(
      matchingNames.map(
        (name) =>
          new Promise<void>((resolve) => {
            try {
              const request = idb.deleteDatabase(name);
              request.onsuccess = () => {
                deleted.push(name);
                resolve();
              };
              request.onerror = () => resolve();
              request.onblocked = () => resolve();
            } catch {
              resolve();
            }
          }),
      ),
    );
  } catch {
    // Best-effort cleanup: never block login or offline initialization.
  }
  return deleted;
}

/**
 * Best-effort removal of orphaned legacy clinic-only IndexedDBs created before
 * per-user database scoping was introduced.
 */
export async function cleanupLegacyClinicDb(
  clinicId: string,
): Promise<string[]> {
  return deleteIndexedDbsByPrefix(legacyDbPrefixFor(clinicId));
}

let current: { key: string; db: OfflineDatabase } | null = null;
let creating: { key: string; promise: Promise<OfflineDatabase> } | null = null;
let pendingDestroy: Promise<void> | null = null;
let lifecycleEpoch = 0;

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

async function openAndInitializeDb(
  name: string,
  password: string,
): Promise<OfflineDatabase> {
  const storage = await buildStorage();
  const db = await createRxDatabase({
    name,
    storage,
    password,
    multiInstance: true,
    eventReduce: true,
    // Cleanly close any stale duplicate instance (e.g. across HMR Fast Refresh)
    closeDuplicates: true,
    ignoreDuplicate: process.env.NODE_ENV !== "production",
  });
  try {
    await db.addCollections(buildCollectionsInput());
  } catch (error) {
    await db.close().catch(() => {});
    throw error;
  }
  return db;
}

/**
 * Lazily create (or return) the per-(clinicId, userId) RxDatabase. Switching
 * clinic or user closes the previous database first. `password` encrypts the
 * at-rest sensitive fields (see collection-registry `encrypted`).
 */
export async function getOfflineDb(
  clinicId: string,
  userId: string,
  password: string,
): Promise<OfflineDatabase> {
  const scopeKey = `${clinicId.toLowerCase()}:${userId.toLowerCase()}`;

  if (current && current.key === scopeKey) {
    return current.db;
  }

  if (creating && creating.key === scopeKey) {
    return creating.promise;
  }

  if (current || creating) {
    await destroyOfflineDb();
  }

  const epochAtStart = lifecycleEpoch;
  const name = dbNameFor(clinicId, userId);

  let creationPromise: Promise<OfflineDatabase> | null = null;
  creationPromise = (async () => {
    try {
      if (pendingDestroy) {
        await pendingDestroy;
      }

      await ensurePlugins();

      let db: OfflineDatabase;
      try {
        db = await openAndInitializeDb(name, password);
      } catch (error) {
        if (!isRxDbPasswordMismatchError(error)) {
          throw error;
        }
        // Self-heal if this user's IndexedDB has a corrupted/mismatched
        // password token: wipe only this user's DB prefix and retry once.
        await deleteIndexedDbsByPrefix(dexieDbPrefixForName(name));
        db = await openAndInitializeDb(name, password);
      }

      if (epochAtStart !== lifecycleEpoch) {
        await db.close().catch(() => {});
        return db;
      }

      current = { key: scopeKey, db };
      return db;
    } finally {
      if (creating?.promise === creationPromise) {
        creating = null;
      }
    }
  })();

  creating = { key: scopeKey, promise: creationPromise };
  return creationPromise;
}

export async function destroyOfflineDb(): Promise<void> {
  lifecycleEpoch += 1;

  const prevCurrent = current;
  const prevCreating = creating;
  const prevDestroy = pendingDestroy;

  current = null;
  creating = null;

  const cleanup = (async () => {
    if (prevDestroy) {
      await prevDestroy.catch(() => {});
    }
    if (prevCurrent) {
      await prevCurrent.db.close().catch(() => {});
    }
    if (prevCreating) {
      // The invalidated creation detects the epoch mismatch and closes its DB.
      await prevCreating.promise.catch(() => {});
    }
  })();

  pendingDestroy = cleanup;
  try {
    await cleanup;
  } finally {
    if (pendingDestroy === cleanup) {
      pendingDestroy = null;
    }
  }
}

export function getCurrentOfflineDb(): OfflineDatabase | null {
  return current?.db ?? null;
}
