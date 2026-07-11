import type { RxJsonSchema } from "rxdb";
import { allFields, type CollectionSpec, type FieldKind } from "./collection-registry";

/** A synced RXDB document — an open bag of JSON-serialisable fields. */
export type SyncDocType = Record<string, unknown>;

// id / clinic_id / updated_at are always present; updated_at is the replication
// checkpoint field and must be a required, indexable, bounded string.
const REQUIRED_FIELDS = ["id", "clinic_id", "updated_at"] as const;

type JsonSchemaProp = {
  type: string | string[];
  format?: string;
  maxLength?: number;
};

function propertyFor(field: string, kind: FieldKind): JsonSchemaProp {
  if (field === "id" || field === "clinic_id") {
    return { type: "string", maxLength: 36 };
  }
  if (field === "updated_at") {
    // Indexed → required, non-nullable, bounded. ISO-8601 fits in 30 chars.
    return { type: "string", format: "date-time", maxLength: 30 };
  }

  switch (kind) {
    case "number":
      return { type: ["number", "null"] };
    case "json":
      return { type: ["object", "null"] };
    case "datetime":
      return { type: ["string", "null"], format: "date-time" };
    case "decimal":
    case "string":
    default:
      return { type: ["string", "null"] };
  }
}

/**
 * Build the RXDB JSON schema for a collection from its registry spec. All
 * schemas are version 0; bump the version and add a migration strategy in
 * collections.ts when a field shape changes.
 */
export function buildRxSchema(spec: CollectionSpec): RxJsonSchema<SyncDocType> {
  const fields = allFields(spec);
  const properties: Record<string, JsonSchemaProp> = {};
  for (const [field, kind] of Object.entries(fields)) {
    properties[field] = propertyFor(field, kind);
  }

  const schema = {
    version: 0,
    primaryKey: "id",
    type: "object",
    properties,
    required: [...REQUIRED_FIELDS],
    indexes: ["updated_at"],
    ...(spec.encrypted && spec.encrypted.length > 0
      ? { encrypted: [...spec.encrypted] }
      : {}),
  } as unknown as RxJsonSchema<SyncDocType>;

  return schema;
}
