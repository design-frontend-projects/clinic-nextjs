import { describe, it, expect, vi, beforeEach } from "vitest";

const { findMany, findFirst, upsert } = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prismaBase: { patients: { findMany, findFirst, upsert } },
}));

import { COLLECTION_BY_NAME } from "../collection-registry";
import {
  pullChangesForClinic,
  pushChangesForClinic,
} from "../sync-server/pull-push";

const patients = COLLECTION_BY_NAME.get("patients")!;

beforeEach(() => {
  findMany.mockReset();
  findFirst.mockReset();
  upsert.mockReset();
});

describe("pullChangesForClinic", () => {
  it("scopes by clinic, includes tombstones, and advances the checkpoint", async () => {
    findMany.mockResolvedValue([
      {
        id: "p1",
        clinic_id: "c1",
        updated_at: new Date("2026-01-01T00:00:00.000Z"),
        deleted_at: null,
      },
      {
        id: "p2",
        clinic_id: "c1",
        updated_at: new Date("2026-01-02T00:00:00.000Z"),
        deleted_at: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);

    const result = await pullChangesForClinic(patients, "c1", null, 100);

    const callArgs = findMany.mock.calls[0][0];
    expect(callArgs.where.clinic_id).toBe("c1");
    // no deleted_at filter → tombstones are returned
    expect("deleted_at" in callArgs.where).toBe(false);
    expect(callArgs.orderBy).toEqual([{ updated_at: "asc" }, { id: "asc" }]);

    expect(result.documents).toHaveLength(2);
    expect(result.documents[1]._deleted).toBe(true);
    expect(result.checkpoint).toEqual({
      id: "p2",
      updated_at: "2026-01-02T00:00:00.000Z",
    });
  });

  it("builds a compound (updated_at, id) filter from a checkpoint", async () => {
    findMany.mockResolvedValue([]);
    const cp = { id: "p1", updated_at: "2026-01-01T00:00:00.000Z" };
    const result = await pullChangesForClinic(patients, "c1", cp, 100);

    const where = findMany.mock.calls[0][0].where;
    expect(where.OR).toEqual([
      { updated_at: { gt: new Date(cp.updated_at) } },
      { updated_at: new Date(cp.updated_at), id: { gt: "p1" } },
    ]);
    // empty result keeps the previous checkpoint
    expect(result.checkpoint).toBe(cp);
  });
});

describe("pushChangesForClinic", () => {
  it("stamps clinic_id from the tenant and ignores the client's clinic_id", async () => {
    findFirst.mockResolvedValue(null); // new record
    upsert.mockResolvedValue({});

    const conflicts = await pushChangesForClinic(patients, "REAL", "branchX", [
      {
        newDocumentState: {
          id: "p9",
          clinic_id: "EVIL",
          updated_at: "2026-01-01T00:00:00.000Z",
          first_name: "Ada",
          _deleted: false,
        },
        assumedMasterState: null,
      },
    ]);

    expect(conflicts).toEqual([]);
    const args = upsert.mock.calls[0][0];
    expect(args.where).toEqual({ id: "p9" });
    expect(args.create.clinic_id).toBe("REAL");
    expect(args.create.branch_id).toBe("branchX");
    expect(args.create.first_name).toBe("Ada");
    // clinic_id is never part of an update payload
    expect("clinic_id" in args.update).toBe(false);
  });

  it("returns the master doc as a conflict when the server moved ahead", async () => {
    findFirst.mockResolvedValue({
      id: "p9",
      clinic_id: "REAL",
      updated_at: new Date("2026-02-01T00:00:00.000Z"),
      first_name: "Server",
      deleted_at: null,
    });

    const conflicts = await pushChangesForClinic(patients, "REAL", null, [
      {
        newDocumentState: {
          id: "p9",
          clinic_id: "REAL",
          updated_at: "2026-01-15T00:00:00.000Z",
          first_name: "Client",
          _deleted: false,
        },
        assumedMasterState: {
          id: "p9",
          clinic_id: "REAL",
          updated_at: "2026-01-10T00:00:00.000Z",
          _deleted: false,
        },
      },
    ]);

    expect(upsert).not.toHaveBeenCalled();
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].first_name).toBe("Server");
  });

  it("applies the write when the client's assumed base matches the server", async () => {
    findFirst.mockResolvedValue({
      id: "p9",
      clinic_id: "REAL",
      updated_at: new Date("2026-01-10T00:00:00.000Z"),
      deleted_at: null,
    });
    upsert.mockResolvedValue({});

    const conflicts = await pushChangesForClinic(patients, "REAL", null, [
      {
        newDocumentState: {
          id: "p9",
          clinic_id: "REAL",
          updated_at: "2026-01-15T00:00:00.000Z",
          first_name: "Client",
          _deleted: false,
        },
        assumedMasterState: {
          id: "p9",
          clinic_id: "REAL",
          updated_at: "2026-01-10T00:00:00.000Z",
          _deleted: false,
        },
      },
    ]);

    expect(conflicts).toEqual([]);
    expect(upsert).toHaveBeenCalledOnce();
  });
});
