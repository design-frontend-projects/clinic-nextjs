/**
 * Single source of truth for the offline-synced clinical collections.
 *
 * Each entry drives, generically:
 *   - the RXDB JSON schema (src/lib/offline/schema.ts)
 *   - the RXDB ↔ server row mappers (src/lib/offline/mappers.ts)
 *   - the pull/push server actions (src/app/actions/sync.ts)
 *
 * `name` is BOTH the RXDB collection name and the Prisma model accessor
 * (snake_case), so the sync layer can look up `prisma[name]` at runtime.
 */

// How a field is represented on the server vs. inside RXDB (which only stores
// JSON-serialisable, sortable values):
//   string   -> string
//   number   -> number
//   datetime -> ISO-8601 string in RXDB, Date on the server
//   decimal  -> string in RXDB (avoids float drift), Decimal/string on server
//   json     -> plain object in RXDB, Json on server
export type FieldKind = "string" | "number" | "datetime" | "decimal" | "json";

export interface CollectionSpec {
  /** RXDB collection name === Prisma model accessor (snake_case). */
  readonly name: string;
  /** Scalar fields to sync, keyed by column name. `id`, `clinic_id` and
   *  `updated_at` are implied and must not be repeated here. */
  readonly fields: Readonly<Record<string, FieldKind>>;
  /** Fields encrypted at rest in IndexedDB. */
  readonly encrypted?: readonly string[];
}

// Implicit on every collection — declared once so specs stay terse.
export const BASE_FIELDS: Readonly<Record<string, FieldKind>> = {
  id: "string",
  clinic_id: "string",
  updated_at: "datetime",
};

export const COLLECTIONS: readonly CollectionSpec[] = [
  {
    name: "patients",
    fields: {
      branch_id: "string",
      profile_id: "string",
      first_name: "string",
      last_name: "string",
      gender: "string",
      date_of_birth: "datetime",
      phone: "string",
      email: "string",
      address: "string",
      created_at: "datetime",
    },
    encrypted: ["phone", "email", "address", "date_of_birth"],
  },
  {
    name: "appointments",
    fields: {
      branch_id: "string",
      patient_id: "string",
      doctor_id: "string",
      appointment_date: "datetime",
      status: "string",
      notes: "string",
      created_at: "datetime",
    },
    encrypted: ["notes"],
  },
  {
    name: "encounters",
    fields: {
      patient_id: "string",
      branch_id: "string",
      doctor_id: "string",
      encounter_type: "string",
      diagnosis: "string",
      encounter_date: "datetime",
      appointment_id: "string",
      notes: "string",
    },
    encrypted: ["diagnosis", "notes"],
  },
  {
    name: "medical_records",
    fields: {
      patient_id: "string",
      doctor_id: "string",
      diagnosis: "string",
      treatment: "string",
      notes: "string",
      created_at: "datetime",
    },
    encrypted: ["diagnosis", "treatment", "notes"],
  },
  {
    name: "lab_orders",
    fields: {
      encounter_id: "string",
      patient_id: "string",
      branch_id: "string",
      doctor_id: "string",
      test_name: "string",
      external_lab_provider: "string",
      external_order_id: "string",
      status: "string",
      created_at: "datetime",
    },
  },
  {
    name: "lab_results",
    fields: {
      lab_order_id: "string",
      result_data: "json",
      result_file_url: "string",
      received_at: "datetime",
    },
    encrypted: ["result_data"],
  },
  {
    name: "invoices",
    fields: {
      branch_id: "string",
      patient_id: "string",
      invoice_type: "string",
      invoice_number: "string",
      total_amount: "decimal",
      status: "string",
      created_at: "datetime",
    },
  },
  {
    name: "invoice_items",
    fields: {
      invoice_id: "string",
      description: "string",
      quantity: "number",
      unit_price: "decimal",
      total_price: "decimal",
    },
  },
  {
    name: "payments",
    fields: {
      invoice_id: "string",
      amount: "decimal",
      payment_method: "string",
      status: "string",
      paid_at: "datetime",
    },
  },
  {
    name: "prescription_dispenses",
    fields: {
      branch_id: "string",
      medical_record_id: "string",
      patient_id: "string",
      dispensed_by: "string",
      dispensed_at: "datetime",
    },
  },
  {
    name: "prescription_dispense_items",
    fields: {
      dispense_id: "string",
      medication_batch_id: "string",
      quantity: "number",
      unit_price: "decimal",
      total_price: "decimal",
    },
  },
];

export const COLLECTION_BY_NAME: ReadonlyMap<string, CollectionSpec> = new Map(
  COLLECTIONS.map((c) => [c.name, c]),
);

/** All fields of a collection, including the implicit base fields. */
export function allFields(
  spec: CollectionSpec,
): Readonly<Record<string, FieldKind>> {
  return { ...BASE_FIELDS, ...spec.fields };
}
