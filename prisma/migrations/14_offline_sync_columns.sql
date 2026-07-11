-- 14_offline_sync_columns.sql
-- Offline-first sync foundation for the core clinical tables.
--
-- Adds the change-tracking columns (`updated_at`, `deleted_at`) that RXDB
-- replication needs (incremental "pull since checkpoint" + tombstone deletes),
-- denormalizes `clinic_id` onto child tables so pull/push and RLS can scope by
-- tenant without joins, and publishes every table to Supabase Realtime so the
-- authenticated browser receives a change-feed (the RXDB `pull.stream$` trigger).
--
-- Mirrors the conventions established in 13_in_app_notifications.sql:
--   * REPLICA IDENTITY FULL + membership in the `supabase_realtime` publication
--   * RLS as defense-in-depth. The app's DATABASE_URL role BYPASSES RLS, so
--     server actions remain the write authority. RLS is granted SELECT only,
--     and is the security boundary for Realtime — the authenticated browser
--     only receives change events for rows its clinic owns.
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Idempotent — safe to re-run.
--
-- Target tables (11): patients, appointments, encounters, lab_orders, invoices,
-- prescription_dispenses (parents) + medical_records, payments, lab_results,
-- invoice_items, prescription_dispense_items (children).

-- ---------------------------------------------------------------------------
-- 1. Shared trigger function — bump updated_at on every UPDATE at the DB level
--    so EVERY write path stays consistent (server actions, raw SQL, and the
--    RXDB push handler alike), not just the offline code.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 2. Add sync columns (updated_at + deleted_at) to all 11 tables.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'patients','appointments','encounters','lab_orders','invoices',
    'prescription_dispenses','medical_records','payments','lab_results',
    'invoice_items','prescription_dispense_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "updated_at" timestamptz NOT NULL DEFAULT now()', t);
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Denormalize clinic_id onto child tables (they only carry a parent FK) and
--    backfill from the parent, so pull/push and RLS scope by tenant directly.
--    Also give PKs lacking a server-side default a gen_random_uuid() safety net
--    (the client/RXDB generates the real UUIDs; this only guards direct inserts).
-- ---------------------------------------------------------------------------

-- payments <- invoices
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;
UPDATE "payments" p SET "clinic_id" = i."clinic_id"
  FROM "invoices" i WHERE p."invoice_id" = i."id" AND p."clinic_id" IS NULL;
ALTER TABLE "payments" ALTER COLUMN "clinic_id" SET NOT NULL;
ALTER TABLE "payments" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- invoice_items <- invoices
ALTER TABLE "invoice_items" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;
UPDATE "invoice_items" ii SET "clinic_id" = i."clinic_id"
  FROM "invoices" i WHERE ii."invoice_id" = i."id" AND ii."clinic_id" IS NULL;
ALTER TABLE "invoice_items" ALTER COLUMN "clinic_id" SET NOT NULL;
ALTER TABLE "invoice_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- lab_results <- lab_orders
ALTER TABLE "lab_results" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;
UPDATE "lab_results" lr SET "clinic_id" = lo."clinic_id"
  FROM "lab_orders" lo WHERE lr."lab_order_id" = lo."id" AND lr."clinic_id" IS NULL;
ALTER TABLE "lab_results" ALTER COLUMN "clinic_id" SET NOT NULL;
ALTER TABLE "lab_results" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- prescription_dispense_items <- prescription_dispenses
ALTER TABLE "prescription_dispense_items" ADD COLUMN IF NOT EXISTS "clinic_id" uuid;
UPDATE "prescription_dispense_items" pdi SET "clinic_id" = pd."clinic_id"
  FROM "prescription_dispenses" pd WHERE pdi."dispense_id" = pd."id" AND pdi."clinic_id" IS NULL;
ALTER TABLE "prescription_dispense_items" ALTER COLUMN "clinic_id" SET NOT NULL;
ALTER TABLE "prescription_dispense_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- medical_records PK had no default (id supplied by app/SQL); add the safety net.
ALTER TABLE "medical_records" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- ---------------------------------------------------------------------------
-- 4. Backfill updated_at from the best available source column per table so
--    existing rows carry a meaningful last-modified time (the DEFAULT now()
--    above already set a value; this refines it). Runs before triggers exist,
--    so it does not recurse. Tables with no source column keep now().
-- ---------------------------------------------------------------------------
UPDATE "patients"               SET "updated_at" = "created_at"     WHERE "created_at"     IS NOT NULL;
UPDATE "appointments"           SET "updated_at" = "created_at"     WHERE "created_at"     IS NOT NULL;
UPDATE "invoices"               SET "updated_at" = "created_at"     WHERE "created_at"     IS NOT NULL;
UPDATE "lab_orders"             SET "updated_at" = "created_at"     WHERE "created_at"     IS NOT NULL;
UPDATE "medical_records"        SET "updated_at" = "created_at"     WHERE "created_at"     IS NOT NULL;
UPDATE "encounters"             SET "updated_at" = "encounter_date" WHERE "encounter_date" IS NOT NULL;
UPDATE "prescription_dispenses" SET "updated_at" = "dispensed_at"   WHERE "dispensed_at"   IS NOT NULL;
UPDATE "payments"               SET "updated_at" = "paid_at"        WHERE "paid_at"        IS NOT NULL;
UPDATE "lab_results"            SET "updated_at" = "received_at"    WHERE "received_at"    IS NOT NULL;
-- invoice_items, prescription_dispense_items: no timestamp source — keep now().

-- ---------------------------------------------------------------------------
-- 5. Per-table wiring: updated_at trigger, REPLICA IDENTITY FULL, RLS + tenant
--    SELECT policy + grant, and publication membership. Uniform across all 11
--    tables (every one now has clinic_id).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'patients','appointments','encounters','lab_orders','invoices',
    'prescription_dispenses','medical_records','payments','lab_results',
    'invoice_items','prescription_dispense_items'
  ];
  has_pub boolean := EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime');
BEGIN
  IF NOT has_pub THEN
    RAISE NOTICE 'Publication supabase_realtime not found — enable Realtime in Supabase, then re-run this block.';
  END IF;

  FOREACH t IN ARRAY tables LOOP
    -- updated_at trigger
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON %I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);

    -- full row images on UPDATE/DELETE so Realtime payloads carry clinic_id + deleted_at
    EXECUTE format('ALTER TABLE %I REPLICA IDENTITY FULL', t);

    -- RLS: authenticated browser may SELECT only its own clinic's rows (Realtime
    -- boundary). Writes never use this role — they go through server actions.
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_tenant_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (' ||
      '"clinic_id" IN (SELECT "clinic_id" FROM "profiles" WHERE "auth_user_id" = auth.uid()))',
      t || '_tenant_select', t
    );

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t || '_super_admin', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR SELECT TO authenticated USING (auth.is_super_admin())',
      t || '_super_admin', t
    );

    EXECUTE format('GRANT SELECT ON %I TO authenticated', t);

    -- publication membership (guarded — only if the publication exists and the
    -- table is not already a member)
    IF has_pub THEN
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
        RAISE NOTICE 'Added "%" to publication supabase_realtime.', t;
      END IF;
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6. Indexes to keep incremental pull (updated_at > checkpoint, scoped by
--    clinic) and soft-delete filtering fast.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'patients','appointments','encounters','lab_orders','invoices',
    'prescription_dispenses','medical_records','payments','lab_results',
    'invoice_items','prescription_dispense_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE INDEX IF NOT EXISTS "idx_%s_clinic_updated" ON %I ("clinic_id", "updated_at")', t, t);
  END LOOP;
END $$;
