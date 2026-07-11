-- 15_prescriptions.sql
-- Doctor-authored prescriptions. A prescription is the prescribing act: a
-- header (patient, doctor, diagnosis, status, issue date) with one or more
-- medication line-items (drug + dosage + frequency + duration + instructions).
--
-- This is distinct from prescription_dispenses / prescription_dispense_items,
-- which model pharmacy fulfillment against medication_batches. A prescription
-- item optionally links the clinic medications catalog (medication_id) but
-- always denormalizes medication_name so free-text (non-catalog) drugs are
-- fully self-describing.
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the app code that
-- uses the prescriptions / prescription_items Prisma models.

-- Enum for prescription lifecycle status (guarded so re-running is safe).
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PrescriptionStatus') THEN
        CREATE TYPE "PrescriptionStatus" AS ENUM ('active', 'completed', 'cancelled');
    END IF;
END$$;

-- Prescription header.
CREATE TABLE IF NOT EXISTS "prescriptions" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinic_id"    UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "branch_id"    UUID REFERENCES "branches"("id"),
    "patient_id"   UUID NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "doctor_id"    UUID REFERENCES "profiles"("id"),
    "encounter_id" UUID REFERENCES "encounters"("id"),
    "diagnosis"    TEXT,
    "notes"        TEXT,
    "status"       "PrescriptionStatus" NOT NULL DEFAULT 'active',
    "issued_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"   TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "prescriptions_clinic_id_idx"  ON "prescriptions" ("clinic_id");
CREATE INDEX IF NOT EXISTS "prescriptions_patient_id_idx" ON "prescriptions" ("patient_id");
CREATE INDEX IF NOT EXISTS "prescriptions_doctor_id_idx"  ON "prescriptions" ("doctor_id");

-- Prescription line-items (the prescribed drugs).
CREATE TABLE IF NOT EXISTS "prescription_items" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinic_id"       UUID NOT NULL,
    "prescription_id" UUID NOT NULL REFERENCES "prescriptions"("id") ON DELETE CASCADE,
    "medication_id"   UUID REFERENCES "medications"("id"),
    "medication_name" TEXT NOT NULL,
    "dosage"          TEXT,
    "frequency"       TEXT,
    "duration"        TEXT,
    "route"           TEXT,
    "quantity"        INTEGER,
    "instructions"    TEXT,
    "updated_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"      TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "prescription_items_prescription_id_idx" ON "prescription_items" ("prescription_id");
CREATE INDEX IF NOT EXISTS "prescription_items_clinic_id_idx"       ON "prescription_items" ("clinic_id");

-- Row Level Security (defense-in-depth; the app reads/writes via Prisma with a
-- direct connection that bypasses RLS, gated at the action layer).
ALTER TABLE "prescriptions"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "prescription_items" ENABLE ROW LEVEL SECURITY;

-- Clinic staff may do anything within their own tenant.
DROP POLICY IF EXISTS prescriptions_clinic_all ON "prescriptions";
CREATE POLICY prescriptions_clinic_all ON "prescriptions"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS prescription_items_clinic_all ON "prescription_items";
CREATE POLICY prescription_items_clinic_all ON "prescription_items"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

-- Patients may read their own prescriptions (portal / receipt view).
DROP POLICY IF EXISTS prescriptions_patient_select ON "prescriptions";
CREATE POLICY prescriptions_patient_select ON "prescriptions"
    FOR SELECT TO authenticated
    USING (
        "patient_id" IN (
            SELECT p.id FROM patients p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS prescription_items_patient_select ON "prescription_items";
CREATE POLICY prescription_items_patient_select ON "prescription_items"
    FOR SELECT TO authenticated
    USING (
        "prescription_id" IN (
            SELECT rx.id FROM prescriptions rx
            JOIN patients p  ON p.id = rx.patient_id
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

-- Super admins may do anything.
DROP POLICY IF EXISTS prescriptions_super_admin ON "prescriptions";
CREATE POLICY prescriptions_super_admin ON "prescriptions"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());

DROP POLICY IF EXISTS prescription_items_super_admin ON "prescription_items";
CREATE POLICY prescription_items_super_admin ON "prescription_items"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());
