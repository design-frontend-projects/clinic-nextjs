import { allFields, type CollectionSpec, type FieldKind } from "./collection-registry";
import type { SyncDocType } from "./schema";

/**
 * Translate between server rows (Prisma: Date, Decimal, Json, plus deleted_at)
 * and RXDB documents (JSON-serialisable, sortable; deletion via `_deleted`).
 * Both directions are driven by the registry field kinds so all 11 collections
 * share one implementation.
 */

export type ServerRow = Record<string, unknown> & {
  deleted_at?: Date | string | null;
};

// Never written back to the server from a client doc: `id` is the upsert key,
// `clinic_id` is stamped from the authenticated tenant, `updated_at` is owned by
// the DB (default now() on insert, trigger-bumped on update).
const WRITE_EXCLUDED = new Set(["id", "clinic_id", "updated_at"]);

function serialise(kind: FieldKind, value: unknown): unknown {
  if (value == null) return null;
  switch (kind) {
    case "datetime":
      return value instanceof Date
        ? value.toISOString()
        : new Date(value as string).toISOString();
    case "decimal":
      return String(value); // Prisma.Decimal → exact string (no float drift)
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "json":
      return value;
    case "string":
    default:
      return String(value);
  }
}

function deserialise(kind: FieldKind, value: unknown): unknown {
  if (value == null) return null;
  switch (kind) {
    case "datetime":
      return new Date(value as string);
    case "decimal":
      return String(value); // Prisma accepts a string for Decimal columns
    case "number":
      return typeof value === "number" ? value : Number(value);
    case "json":
      return value;
    case "string":
    default:
      return String(value);
  }
}

/** Server row → RXDB document. */
export function toRxDoc(spec: CollectionSpec, row: ServerRow): SyncDocType {
  const fields = allFields(spec);
  const doc: SyncDocType = {};
  for (const [field, kind] of Object.entries(fields)) {
    doc[field] = serialise(kind, row[field]);
  }
  doc._deleted = row.deleted_at != null;
  return doc;
}

/**
 * RXDB document → the payload for a Prisma upsert on the server. Excludes the
 * id/clinic_id/updated_at fields (see WRITE_EXCLUDED) and derives `deleted_at`
 * from the `_deleted` tombstone flag.
 */
export function fromRxDoc(
  spec: CollectionSpec,
  doc: SyncDocType,
): { id: string; data: Record<string, unknown>; deleted: boolean } {
  const fields = allFields(spec);
  const data: Record<string, unknown> = {};
  for (const [field, kind] of Object.entries(fields)) {
    if (WRITE_EXCLUDED.has(field)) continue;
    data[field] = deserialise(kind, doc[field]);
  }
  const deleted = doc._deleted === true;
  data.deleted_at = deleted ? new Date() : null;
  return { id: String(doc.id), data, deleted };
}

/** ISO string of a row's updated_at, for building replication checkpoints. */
export function updatedAtIso(row: ServerRow): string {
  const value = row.updated_at;
  if (value instanceof Date) return value.toISOString();
  return new Date(value as string).toISOString();
}
