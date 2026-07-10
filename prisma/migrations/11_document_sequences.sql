-- 11_document_sequences.sql
-- Configurable, atomic document numbering per tenant (invoice, receipt,
-- patient_file, lab_order, ...). Numbers are claimed via
-- public.claim_document_number(tenant, type): a single
-- INSERT ... ON CONFLICT DO UPDATE ... RETURNING — the row lock serializes
-- concurrent claims without app-level locking.
--
-- Also adds invoices.invoice_number + backfills existing invoices.
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run (the backfill only touches NULL invoice_numbers).

-- ---------------------------------------------------------------------------
-- 1. document_sequences — one row per (tenant, type, period)
--    The row is both the counter and the format config for its period; a new
--    period row inherits config from the latest row of the same (tenant,type).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "document_sequences" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"      UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "document_type"  TEXT NOT NULL,                 -- 'invoice','receipt','patient_file','lab_order'
    "prefix"         TEXT NOT NULL DEFAULT '',
    "padding"        INTEGER NOT NULL DEFAULT 5 CHECK ("padding" BETWEEN 1 AND 12),
    "reset_period"   TEXT NOT NULL DEFAULT 'never' CHECK ("reset_period" IN ('never','yearly','monthly')),
    "period_key"     TEXT NOT NULL DEFAULT '',      -- ''  |  '2026'  |  '2026-07'
    "include_period" BOOLEAN NOT NULL DEFAULT TRUE, -- include period_key in the formatted number
    "current_value"  BIGINT NOT NULL DEFAULT 0,
    "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"     TIMESTAMP,
    "created_by"     UUID,
    "updated_by"     UUID,
    CONSTRAINT "document_sequences_tenant_type_period_key" UNIQUE ("tenant_id", "document_type", "period_key")
);

CREATE INDEX IF NOT EXISTS "idx_document_sequences_tenant"
    ON "document_sequences" ("tenant_id", "document_type");

-- ---------------------------------------------------------------------------
-- 2. Atomic claim function
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_document_number(p_tenant_id UUID, p_document_type TEXT)
RETURNS TEXT AS $$
DECLARE
  v_prefix         TEXT    := upper(left(p_document_type, 3)) || '-';
  v_padding        INTEGER := 5;
  v_reset_period   TEXT    := 'never';
  v_include_period BOOLEAN := TRUE;
  v_period_key     TEXT;
  v_value          BIGINT;
BEGIN
  -- Latest row for (tenant, type) carries the current format config;
  -- if none exists yet the defaults above apply.
  SELECT "prefix", "padding", "reset_period", "include_period"
    INTO v_prefix, v_padding, v_reset_period, v_include_period
    FROM "document_sequences"
   WHERE "tenant_id" = p_tenant_id AND "document_type" = p_document_type
   ORDER BY "created_at" DESC
   LIMIT 1;

  v_period_key := CASE v_reset_period
    WHEN 'yearly'  THEN to_char(now(), 'YYYY')
    WHEN 'monthly' THEN to_char(now(), 'YYYY-MM')
    ELSE ''
  END;

  -- Atomic: the conflicting UPDATE takes a row lock, serializing concurrent claims.
  INSERT INTO "document_sequences"
      ("tenant_id", "document_type", "prefix", "padding", "reset_period", "include_period", "period_key", "current_value")
  VALUES
      (p_tenant_id, p_document_type, v_prefix, v_padding, v_reset_period, v_include_period, v_period_key, 1)
  ON CONFLICT ("tenant_id", "document_type", "period_key")
  DO UPDATE SET "current_value" = "document_sequences"."current_value" + 1,
                "updated_at"    = now()
  RETURNING "current_value" INTO v_value;

  RETURN v_prefix
      || CASE WHEN v_include_period AND v_period_key <> '' THEN v_period_key || '-' ELSE '' END
      || lpad(v_value::TEXT, v_padding, '0');
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (defense-in-depth; app connection bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE "document_sequences" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS document_sequences_tenant_isolation ON "document_sequences";
CREATE POLICY document_sequences_tenant_isolation ON "document_sequences"
    FOR ALL TO authenticated
    USING ("tenant_id" = auth.current_tenant_id())
    WITH CHECK ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS document_sequences_super_admin ON "document_sequences";
CREATE POLICY document_sequences_super_admin ON "document_sequences"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. invoices.invoice_number + backfill
-- ---------------------------------------------------------------------------
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT;

-- Backfill existing invoices per clinic in creation order. Only touches rows
-- with a NULL invoice_number, so re-running is a no-op.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT "id", "clinic_id" FROM "invoices"
    WHERE "invoice_number" IS NULL
    ORDER BY "clinic_id", "created_at", "id"
  LOOP
    UPDATE "invoices"
       SET "invoice_number" = public.claim_document_number(r."clinic_id", 'invoice')
     WHERE "id" = r."id";
  END LOOP;
END $$;

-- Uniqueness per clinic (partial index — created after the backfill; cannot be
-- expressed in schema.prisma).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_invoices_clinic_number"
    ON "invoices" ("clinic_id", "invoice_number") WHERE "invoice_number" IS NOT NULL;
