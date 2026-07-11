import { Prisma } from "@prisma/client";

/**
 * Soft-delete filter for the offline-sync clinical tables.
 *
 * The RXDB replication layer represents deletes as tombstones (`deleted_at` set)
 * rather than removing rows, so the change-feed can propagate the delete. App
 * reads must therefore exclude tombstoned rows — otherwise "deleted" records
 * reappear in the UI. This extension injects `deleted_at: null` into every read
 * on the soft-deletable models at a single point, so no call site can forget it.
 *
 * Escape hatch: a caller that sets `deleted_at` explicitly in its `where` opts
 * out (used by the sync PULL handler, which must see tombstones). Prefer the
 * un-extended `prismaBase` client for that path.
 */

export const SOFT_DELETE_MODELS: ReadonlySet<string> = new Set(
  [
    "patients",
    "appointments",
    "encounters",
    "lab_orders",
    "lab_results",
    "invoices",
    "invoice_items",
    "payments",
    "medical_records",
    "prescription_dispenses",
    "prescription_dispense_items",
  ].map((m) => m.toLowerCase()),
);

// Read/aggregate ops where we inject the filter into `where`.
export const FILTERED_MANY_OPS: ReadonlySet<string> = new Set([
  "findMany",
  "findFirst",
  "findFirstOrThrow",
  "count",
  "aggregate",
  "groupBy",
  "updateMany",
  "deleteMany",
]);

// findUnique* only accepts unique fields in `where`, so we can't inject there;
// instead we filter the result after the fact.
export const UNIQUE_OPS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
]);

export function isSoftDeleteModel(model: string): boolean {
  return SOFT_DELETE_MODELS.has(model.toLowerCase());
}

function hasExplicitDeletedAt(where: unknown): boolean {
  return (
    typeof where === "object" &&
    where !== null &&
    "deleted_at" in (where as Record<string, unknown>)
  );
}

type QueryArgs = { where?: Record<string, unknown> } & Record<string, unknown>;

/**
 * Pure decision: given a model/operation/args, return the args a filtered read
 * should run with. Returns the input unchanged when no injection applies (wrong
 * model, non-filtered op, or the caller already scoped `deleted_at`). Exported
 * for unit testing without a database.
 */
export function withSoftDeleteFilter(
  model: string,
  operation: string,
  args: QueryArgs | undefined,
): QueryArgs | undefined {
  if (!isSoftDeleteModel(model)) return args;
  if (!FILTERED_MANY_OPS.has(operation)) return args;

  const typedArgs = args ?? {};
  if (hasExplicitDeletedAt(typedArgs.where)) return args;

  return { ...typedArgs, where: { ...typedArgs.where, deleted_at: null } };
}

export const softDeleteExtension = Prisma.defineExtension({
  name: "soft-delete-filter",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!isSoftDeleteModel(model)) {
          return query(args);
        }

        if (FILTERED_MANY_OPS.has(operation)) {
          const filtered = withSoftDeleteFilter(model, operation, args as QueryArgs);
          return query(filtered as typeof args);
        }

        if (UNIQUE_OPS.has(operation)) {
          const result = (await query(args)) as { deleted_at?: Date | null } | null;
          if (result && result.deleted_at != null) {
            if (operation === "findUniqueOrThrow") {
              throw new Error(`No ${model} found`);
            }
            return null;
          }
          return result;
        }

        return query(args);
      },
    },
  },
});
