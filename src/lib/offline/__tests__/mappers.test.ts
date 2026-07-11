import { describe, it, expect } from "vitest";
import { COLLECTION_BY_NAME } from "../collection-registry";
import { toRxDoc, fromRxDoc, updatedAtIso } from "../mappers";

const patients = COLLECTION_BY_NAME.get("patients")!;
const invoiceItems = COLLECTION_BY_NAME.get("invoice_items")!;

describe("toRxDoc", () => {
  it("serialises dates to ISO strings and marks live rows as not deleted", () => {
    const row = {
      id: "p1",
      clinic_id: "c1",
      first_name: "Ada",
      date_of_birth: new Date("1990-05-01T00:00:00.000Z"),
      created_at: new Date("2026-01-01T10:00:00.000Z"),
      updated_at: new Date("2026-02-02T12:00:00.000Z"),
      deleted_at: null,
    };
    const doc = toRxDoc(patients, row);
    expect(doc.id).toBe("p1");
    expect(doc.clinic_id).toBe("c1");
    expect(doc.first_name).toBe("Ada");
    expect(doc.date_of_birth).toBe("1990-05-01T00:00:00.000Z");
    expect(doc.updated_at).toBe("2026-02-02T12:00:00.000Z");
    expect(doc._deleted).toBe(false);
  });

  it("maps a set deleted_at to the _deleted tombstone flag", () => {
    const doc = toRxDoc(patients, {
      id: "p1",
      clinic_id: "c1",
      updated_at: new Date("2026-02-02T12:00:00.000Z"),
      deleted_at: new Date("2026-02-03T00:00:00.000Z"),
    });
    expect(doc._deleted).toBe(true);
  });

  it("serialises decimals to exact strings (no float drift)", () => {
    const decimalLike = { toString: () => "12.50" };
    const doc = toRxDoc(invoiceItems, {
      id: "i1",
      clinic_id: "c1",
      updated_at: new Date("2026-02-02T12:00:00.000Z"),
      unit_price: decimalLike,
      quantity: 2,
    });
    expect(doc.unit_price).toBe("12.50");
    expect(doc.quantity).toBe(2);
  });
});

describe("fromRxDoc", () => {
  it("excludes id/clinic_id/updated_at and rebuilds dates", () => {
    const { id, data, deleted } = fromRxDoc(patients, {
      id: "p1",
      clinic_id: "c1",
      updated_at: "2026-02-02T12:00:00.000Z",
      first_name: "Ada",
      date_of_birth: "1990-05-01T00:00:00.000Z",
      _deleted: false,
    });
    expect(id).toBe("p1");
    expect(deleted).toBe(false);
    expect("clinic_id" in data).toBe(false);
    expect("updated_at" in data).toBe(false);
    expect(data.first_name).toBe("Ada");
    expect(data.date_of_birth).toBeInstanceOf(Date);
    expect(data.deleted_at).toBeNull();
  });

  it("derives deleted_at from the _deleted flag", () => {
    const { data, deleted } = fromRxDoc(patients, {
      id: "p1",
      clinic_id: "c1",
      updated_at: "2026-02-02T12:00:00.000Z",
      _deleted: true,
    });
    expect(deleted).toBe(true);
    expect(data.deleted_at).toBeInstanceOf(Date);
  });

  it("round-trips a decimal field back to a string", () => {
    const { data } = fromRxDoc(invoiceItems, {
      id: "i1",
      clinic_id: "c1",
      updated_at: "2026-02-02T12:00:00.000Z",
      unit_price: "12.50",
      quantity: 2,
    });
    expect(data.unit_price).toBe("12.50");
    expect(data.quantity).toBe(2);
  });
});

describe("updatedAtIso", () => {
  it("accepts Date and string sources", () => {
    expect(updatedAtIso({ updated_at: new Date("2026-02-02T12:00:00.000Z") })).toBe(
      "2026-02-02T12:00:00.000Z",
    );
    expect(updatedAtIso({ updated_at: "2026-02-02T12:00:00.000Z" })).toBe(
      "2026-02-02T12:00:00.000Z",
    );
  });
});
