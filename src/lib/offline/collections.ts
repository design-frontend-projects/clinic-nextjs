import type { RxCollectionCreator } from "rxdb";
import { COLLECTIONS } from "./collection-registry";
import { buildRxSchema, type SyncDocType } from "./schema";
import { lwwConflictHandler } from "./conflict-handler";

/**
 * Build the map passed to `db.addCollections(...)`. All collections are schema
 * version 0; when a field shape changes, bump the version in schema.ts and add
 * the corresponding entry to `migrationStrategies` here so RXDB migrates the
 * locally-stored documents.
 */
export function buildCollectionsInput(): Record<
  string,
  RxCollectionCreator<SyncDocType>
> {
  const input: Record<string, RxCollectionCreator<SyncDocType>> = {};
  for (const spec of COLLECTIONS) {
    input[spec.name] = {
      schema: buildRxSchema(spec),
      migrationStrategies: {},
      conflictHandler: lwwConflictHandler,
    };
  }
  return input;
}
