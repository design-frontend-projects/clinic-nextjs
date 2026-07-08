import { describe, it, expect, vi } from "vitest";
import {
  diffSpecialtyIds,
  syncDoctorSpecialties,
  type DoctorSpecialtiesClient,
} from "@/lib/doctor-specialties";

describe("diffSpecialtyIds", () => {
  it("adds new ids and removes dropped ones", () => {
    expect(diffSpecialtyIds(["a", "b"], ["b", "c"])).toEqual({
      toAdd: ["c"],
      toRemove: ["a"],
    });
  });

  it("is a no-op when the sets are equal (order-insensitive)", () => {
    expect(diffSpecialtyIds(["a", "b"], ["b", "a"])).toEqual({
      toAdd: [],
      toRemove: [],
    });
  });

  it("adds everything from an empty starting point", () => {
    expect(diffSpecialtyIds([], ["a", "b"])).toEqual({
      toAdd: ["a", "b"],
      toRemove: [],
    });
  });

  it("removes everything when the next selection is empty", () => {
    expect(diffSpecialtyIds(["a", "b"], [])).toEqual({
      toAdd: [],
      toRemove: ["a", "b"],
    });
  });

  it("de-duplicates inputs on both sides", () => {
    expect(diffSpecialtyIds(["a", "a"], ["b", "b", "a"])).toEqual({
      toAdd: ["b"],
      toRemove: [],
    });
  });
});

describe("syncDoctorSpecialties", () => {
  function makeClient(existing: string[]) {
    const createMany = vi.fn().mockResolvedValue({ count: 0 });
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 });
    const client: DoctorSpecialtiesClient = {
      doctor_specialties: {
        findMany: vi
          .fn()
          .mockResolvedValue(existing.map((specialty_id) => ({ specialty_id }))),
        createMany,
        deleteMany,
      },
    };
    return { client, createMany, deleteMany };
  }

  it("creates only the added rows and deletes only the removed ones", async () => {
    const { client, createMany, deleteMany } = makeClient(["a", "b"]);

    const diff = await syncDoctorSpecialties(client, "profile-1", ["b", "c"]);

    expect(diff).toEqual({ toAdd: ["c"], toRemove: ["a"] });
    expect(deleteMany).toHaveBeenCalledWith({
      where: { profile_id: "profile-1", specialty_id: { in: ["a"] } },
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [{ profile_id: "profile-1", specialty_id: "c" }],
      skipDuplicates: true,
    });
  });

  it("does not touch the database when nothing changed", async () => {
    const { client, createMany, deleteMany } = makeClient(["a", "b"]);

    await syncDoctorSpecialties(client, "profile-1", ["a", "b"]);

    expect(createMany).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
