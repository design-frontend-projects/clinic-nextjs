import { describe, it, expect, vi } from "vitest";
import type { WithDeleted } from "rxdb";
import { lwwConflictHandler, conflictEvents$ } from "../conflict-handler";
import type { SyncDocType } from "../schema";

function doc(
  id: string,
  updated_at: string,
  deleted = false,
): WithDeleted<SyncDocType> {
  return { id, updated_at, _deleted: deleted } as WithDeleted<SyncDocType>;
}

const ctx = "test";

describe("lwwConflictHandler.isEqual", () => {
  it("is true when id, _deleted and updated_at all match", () => {
    expect(
      lwwConflictHandler.isEqual(
        doc("a", "2026-01-01T00:00:00.000Z"),
        doc("a", "2026-01-01T00:00:00.000Z"),
        ctx,
      ),
    ).toBe(true);
  });

  it("is false when updated_at differs", () => {
    expect(
      lwwConflictHandler.isEqual(
        doc("a", "2026-01-01T00:00:00.000Z"),
        doc("a", "2026-01-02T00:00:00.000Z"),
        ctx,
      ),
    ).toBe(false);
  });
});

describe("lwwConflictHandler.resolve", () => {
  it("keeps the strictly-newer client document", async () => {
    const result = await lwwConflictHandler.resolve(
      {
        realMasterState: doc("a", "2026-01-01T00:00:00.000Z"),
        newDocumentState: doc("a", "2026-01-02T00:00:00.000Z"),
      },
      ctx,
    );
    expect(result.updated_at).toBe("2026-01-02T00:00:00.000Z");
  });

  it("keeps the server document when it is newer", async () => {
    const result = await lwwConflictHandler.resolve(
      {
        realMasterState: doc("a", "2026-01-03T00:00:00.000Z"),
        newDocumentState: doc("a", "2026-01-02T00:00:00.000Z"),
      },
      ctx,
    );
    expect(result.updated_at).toBe("2026-01-03T00:00:00.000Z");
  });

  it("resolves ties to the server and emits a conflict event", async () => {
    const spy = vi.fn();
    const sub = conflictEvents$.subscribe(spy);
    const same = "2026-01-05T00:00:00.000Z";
    const result = await lwwConflictHandler.resolve(
      {
        realMasterState: doc("a", same),
        newDocumentState: { ...doc("a", same), notes: "local edit" },
      },
      ctx,
    );
    expect(result.notes).toBeUndefined(); // server (realMaster) won
    expect(spy).toHaveBeenCalledWith({ serverWon: true });
    sub.unsubscribe();
  });
});
