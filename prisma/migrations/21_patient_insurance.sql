-- 21_patient_insurance.sql
-- Patient insurance module. Upgrades the three pre-existing (but unused)
-- insurance tables into a tenant-scoped module:
--
--   insurance_providers  — insurance companies defined per clinic, each with a
--                          deduction rule (fixed amount or percentage of the
--                          invoice gross) and an optional covered-visits limit
--                          (NULL = unlimited).
--   patient_insurances   — a patient's policy with one provider (policy number,
--                          validity window, visits_used countdown).
--   insurance_claims     — one row per insured invoice: the amount the insurer
--                          owes the clinic (created automatically at billing).
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the app code that
-- uses the extended insurance Prisma models.

-- Deduction rule type (guarded so re-running is safe).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InsuranceDeductionType') THEN
        CREATE TYPE "InsuranceDeductionType" AS ENUM ('fixed', 'percentage');
    END IF;
END$$;

-- ---------------------------------------------------------------------------
-- insurance_providers: tenant scope + deduction rule
-- ---------------------------------------------------------------------------
ALTER TABLE "insurance_providers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "insurance_providers"
    ADD COLUMN IF NOT EXISTS "clinic_id"       UUID REFERENCES "clinics"("id") ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS "deduction_type"  "InsuranceDeductionType" NOT NULL DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS "deduction_value" DECIMAL(12,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "covered_visits"  INTEGER,
    ADD COLUMN IF NOT EXISTS "is_active"       BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "created_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updated_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deleted_at"      TIMESTAMP;

-- The table was never used by the app; any legacy rows have no tenant and
-- cannot be scoped, so drop them before enforcing NOT NULL.
DELETE FROM "insurance_providers" WHERE "clinic_id" IS NULL;
ALTER TABLE "insurance_providers" ALTER COLUMN "clinic_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "insurance_providers_clinic_id_idx"
    ON "insurance_providers" ("clinic_id");

-- ---------------------------------------------------------------------------
-- patient_insurances: tenant scope + visit countdown
-- ---------------------------------------------------------------------------
ALTER TABLE "patient_insurances" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE "patient_insurances"
    ADD COLUMN IF NOT EXISTS "clinic_id"   UUID REFERENCES "clinics"("id") ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS "visits_used" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "is_active"   BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "updated_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "deleted_at"  TIMESTAMP;

DELETE FROM "patient_insurances" WHERE "clinic_id" IS NULL;
ALTER TABLE "patient_insurances" ALTER COLUMN "clinic_id" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "patient_insurances_clinic_id_idx"
    ON "patient_insurances" ("clinic_id");
CREATE INDEX IF NOT EXISTS "patient_insurances_patient_id_idx"
    ON "patient_insurances" ("patient_id");

-- One live policy per (patient, provider); soft-deleted rows don't block re-adding.
CREATE UNIQUE INDEX IF NOT EXISTS "patient_insurances_patient_provider_live_uq"
    ON "patient_insurances" ("patient_id", "provider_id")
    WHERE "deleted_at" IS NULL;

-- ---------------------------------------------------------------------------
-- insurance_claims: id default only (columns already fit the module)
-- ---------------------------------------------------------------------------
ALTER TABLE "insurance_claims" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

CREATE INDEX IF NOT EXISTS "insurance_claims_clinic_id_idx"
    ON "insurance_claims" ("clinic_id");
CREATE INDEX IF NOT EXISTS "insurance_claims_invoice_id_idx"
    ON "insurance_claims" ("invoice_id");

-- ---------------------------------------------------------------------------
-- Row Level Security (defense-in-depth; the app reads/writes via Prisma with a
-- direct connection that bypasses RLS, gated at the action layer).
-- ---------------------------------------------------------------------------
ALTER TABLE "insurance_providers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "patient_insurances"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "insurance_claims"    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insurance_providers_clinic_all ON "insurance_providers";
CREATE POLICY insurance_providers_clinic_all ON "insurance_providers"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS patient_insurances_clinic_all ON "patient_insurances";
CREATE POLICY patient_insurances_clinic_all ON "patient_insurances"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS insurance_claims_clinic_all ON "insurance_claims";
CREATE POLICY insurance_claims_clinic_all ON "insurance_claims"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

-- Patients may read their own coverage (portal view).
DROP POLICY IF EXISTS patient_insurances_patient_select ON "patient_insurances";
CREATE POLICY patient_insurances_patient_select ON "patient_insurances"
    FOR SELECT TO authenticated
    USING (
        "patient_id" IN (
            SELECT p.id FROM patients p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

-- Super admins may do anything.
DROP POLICY IF EXISTS insurance_providers_super_admin ON "insurance_providers";
CREATE POLICY insurance_providers_super_admin ON "insurance_providers"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());

DROP POLICY IF EXISTS patient_insurances_super_admin ON "patient_insurances";
CREATE POLICY patient_insurances_super_admin ON "patient_insurances"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());

DROP POLICY IF EXISTS insurance_claims_super_admin ON "insurance_claims";
CREATE POLICY insurance_claims_super_admin ON "insurance_claims"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());
