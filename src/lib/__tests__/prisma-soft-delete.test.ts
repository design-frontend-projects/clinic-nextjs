import { describe, it, expect } from "vitest";
import {
  withSoftDeleteFilter,
  isSoftDeleteModel,
} from "../prisma-soft-delete";

describe("isSoftDeleteModel", () => {
  it("matches the clinical sync tables case-insensitively", () => {
    expect(isSoftDeleteModel("patients")).toBe(true);
    expect(isSoftDeleteModel("Patients")).toBe(true);
    expect(isSoftDeleteModel("prescription_dispense_items")).toBe(true);
  });

  it("does not touch non-sync models", () => {
    expect(isSoftDeleteModel("profiles")).toBe(false);
    expect(isSoftDeleteModel("roles")).toBe(false);
    expect(isSoftDeleteModel("clinics")).toBe(false);
  });
});

describe("withSoftDeleteFilter", () => {
  it("injects deleted_at: null into a findMany with an existing where", () => {
    const out = withSoftDeleteFilter("patients", "findMany", {
      where: { clinic_id: "c1" },
    });
    expect(out).toEqual({ where: { clinic_id: "c1", deleted_at: null } });
  });

  it("injects deleted_at: null when there is no args at all (e.g. count())", () => {
    const out = withSoftDeleteFilter("patients", "count", undefined);
    expect(out).toEqual({ where: { deleted_at: null } });
  });

  it("respects an explicit deleted_at (the sync PULL escape hatch)", () => {
    const args = { where: { clinic_id: "c1", deleted_at: { not: null } } };
    expect(withSoftDeleteFilter("patients", "findMany", args)).toBe(args);
  });

  it("leaves non-sync models untouched", () => {
    const args = { where: { id: "p1" } };
    expect(withSoftDeleteFilter("profiles", "findMany", args)).toBe(args);
  });

  it("leaves write ops (create/update/upsert) untouched", () => {
    const args = { where: { id: "p1" }, data: { first_name: "A" } };
    expect(withSoftDeleteFilter("patients", "update", args)).toBe(args);
    expect(withSoftDeleteFilter("patients", "create", { data: {} })).toEqual({
      data: {},
    });
  });

  it("filters bulk read/aggregate ops", () => {
    for (const op of ["findFirst", "aggregate", "groupBy", "updateMany"]) {
      const out = withSoftDeleteFilter("appointments", op, {
        where: { clinic_id: "c1" },
      });
      expect(out).toEqual({ where: { clinic_id: "c1", deleted_at: null } });
    }
  });

  it("does not mutate the caller's args object", () => {
    const args = { where: { clinic_id: "c1" } };
    withSoftDeleteFilter("patients", "findMany", args);
    expect(args).toEqual({ where: { clinic_id: "c1" } });
  });
});
