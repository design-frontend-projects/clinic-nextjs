import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockCreateRxDatabase, mockAddRxPlugin } = vi.hoisted(() => ({
  mockCreateRxDatabase: vi.fn(),
  mockAddRxPlugin: vi.fn(),
}));

vi.mock("rxdb", () => ({
  addRxPlugin: mockAddRxPlugin,
  createRxDatabase: mockCreateRxDatabase,
}));

vi.mock("rxdb/plugins/storage-dexie", () => ({
  getRxStorageDexie: vi.fn(() => ({ name: "dexie" })),
}));

vi.mock("rxdb/plugins/leader-election", () => ({
  RxDBLeaderElectionPlugin: { name: "leader-election" },
}));

vi.mock("rxdb/plugins/migration-schema", () => ({
  RxDBMigrationSchemaPlugin: { name: "migration-schema" },
}));

vi.mock("rxdb/plugins/update", () => ({
  RxDBUpdatePlugin: { name: "update" },
}));

vi.mock("rxdb/plugins/encryption-crypto-js", () => ({
  wrappedKeyEncryptionCryptoJsStorage: vi.fn(({ storage }) => ({
    name: "encrypted",
    storage,
  })),
}));

vi.mock("rxdb/plugins/dev-mode", () => ({
  RxDBDevModePlugin: { name: "dev-mode" },
}));

vi.mock("rxdb/plugins/validate-ajv", () => ({
  wrappedValidateAjvStorage: vi.fn(({ storage }) => ({
    name: "validated",
    storage,
  })),
}));

vi.mock("../collections", () => ({
  buildCollectionsInput: vi.fn(() => ({ patients: { schema: {} } })),
}));

import {
  cleanupLegacyClinicDb,
  dbNameFor,
  destroyOfflineDb,
  getCurrentOfflineDb,
  getOfflineDb,
  legacyDbPrefixFor,
} from "../db";

function makeFakeDb(label: string) {
  return {
    name: label,
    addCollections: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue(undefined),
  };
}

function stubIndexedDb(existingNames: string[]) {
  const deleted: string[] = [];
  const deleteDatabase = vi.fn((name: string) => {
    const req: {
      onsuccess?: () => void;
      onerror?: () => void;
      onblocked?: () => void;
    } = {};
    queueMicrotask(() => {
      deleted.push(name);
      req.onsuccess?.();
    });
    return req;
  });

  vi.stubGlobal("indexedDB", {
    databases: vi.fn().mockResolvedValue(existingNames.map((name) => ({ name }))),
    deleteDatabase,
  });

  return { deleted, deleteDatabase };
}

describe("offline RxDB lifecycle & per-user isolation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await destroyOfflineDb();
  });

  afterEach(async () => {
    await destroyOfflineDb();
    vi.unstubAllGlobals();
  });

  it("scopes database names per (clinicId, userId) in lowercase", () => {
    expect(dbNameFor("Clinic-ABC", "User-123")).toBe(
      "clinicdb_clinic-abc_user-123",
    );
    expect(dbNameFor("Clinic-ABC", "User-456")).toBe(
      "clinicdb_clinic-abc_user-456",
    );
    expect(legacyDbPrefixFor("Clinic-ABC")).toBe(
      "rxdb-dexie-clinicdb_clinic-abc--",
    );
  });

  it("closes User A's DB and opens a separate DB when User B in the same clinic logs in", async () => {
    const dbUserA = makeFakeDb("user-a");
    const dbUserB = makeFakeDb("user-b");
    mockCreateRxDatabase
      .mockResolvedValueOnce(dbUserA)
      .mockResolvedValueOnce(dbUserB);

    const first = await getOfflineDb("clinic-1", "user-a", "clinic-1:user-a");
    expect(first).toBe(dbUserA);
    expect(mockCreateRxDatabase).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        name: "clinicdb_clinic-1_user-a",
        password: "clinic-1:user-a",
        closeDuplicates: true,
      }),
    );

    // Same user & clinic returns cached instance without recreating
    const cached = await getOfflineDb("clinic-1", "user-a", "clinic-1:user-a");
    expect(cached).toBe(dbUserA);
    expect(mockCreateRxDatabase).toHaveBeenCalledTimes(1);

    // Different user in the SAME clinic closes User A's DB and opens User B's DB
    const second = await getOfflineDb("clinic-1", "user-b", "clinic-1:user-b");
    expect(dbUserA.close).toHaveBeenCalledTimes(1);
    expect(second).toBe(dbUserB);
    expect(getCurrentOfflineDb()).toBe(dbUserB);
    expect(mockCreateRxDatabase).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        name: "clinicdb_clinic-1_user-b",
        password: "clinic-1:user-b",
      }),
    );
  });

  it("clears the in-flight creation promise on failure so subsequent retries succeed", async () => {
    const dbRetry = makeFakeDb("retry-ok");
    mockCreateRxDatabase
      .mockRejectedValueOnce(new Error("transient storage failure"))
      .mockResolvedValueOnce(dbRetry);

    await expect(
      getOfflineDb("clinic-1", "user-a", "clinic-1:user-a"),
    ).rejects.toThrow("transient storage failure");

    const recovered = await getOfflineDb("clinic-1", "user-a", "clinic-1:user-a");
    expect(recovered).toBe(dbRetry);
    expect(mockCreateRxDatabase).toHaveBeenCalledTimes(2);
  });

  it("self-heals on DB1 by deleting only that user's Dexie IndexedDB prefix and retrying once", async () => {
    const { deleted } = stubIndexedDb([
      "rxdb-dexie-clinicdb_clinic-1_user-a--0--_rxdb_internal",
      "rxdb-dexie-clinicdb_clinic-1_user-a--0--patients",
      "rxdb-dexie-clinicdb_clinic-1_user-b--0--patients",
    ]);

    const db1Error = Object.assign(new Error("password mismatch"), {
      code: "DB1",
      rxdb: true,
    });
    const dbRecovered = makeFakeDb("recovered");
    mockCreateRxDatabase
      .mockRejectedValueOnce(db1Error)
      .mockResolvedValueOnce(dbRecovered);

    const db = await getOfflineDb("clinic-1", "user-a", "clinic-1:user-a");
    expect(db).toBe(dbRecovered);
    expect(deleted).toEqual([
      "rxdb-dexie-clinicdb_clinic-1_user-a--0--_rxdb_internal",
      "rxdb-dexie-clinicdb_clinic-1_user-a--0--patients",
    ]);
  });

  it("cleanupLegacyClinicDb removes only legacy clinic-only IDBs and preserves per-user IDBs", async () => {
    const { deleted } = stubIndexedDb([
      "rxdb-dexie-clinicdb_clinic-1--0--_rxdb_internal",
      "rxdb-dexie-clinicdb_clinic-1--0--patients",
      "rxdb-dexie-clinicdb_clinic-1_user-a--0--patients",
      "rxdb-dexie-clinicdb_clinic-2--0--patients",
    ]);

    const removed = await cleanupLegacyClinicDb("Clinic-1");
    expect(removed).toEqual([
      "rxdb-dexie-clinicdb_clinic-1--0--_rxdb_internal",
      "rxdb-dexie-clinicdb_clinic-1--0--patients",
    ]);
    expect(deleted).toEqual(removed);
  });
});
