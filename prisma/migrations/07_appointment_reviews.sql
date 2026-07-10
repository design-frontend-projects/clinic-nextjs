-- 07_appointment_reviews.sql
-- Patient ratings for completed appointments (1-5 stars + optional comment).
-- Reviews start as 'pending' and require clinic-admin approval before they
-- appear in the public landing-page testimonial section.
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the app code
-- that uses the appointment_reviews Prisma model.

CREATE TABLE IF NOT EXISTS "appointment_reviews" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "appointment_id" UUID NOT NULL UNIQUE REFERENCES "appointments"("id") ON DELETE CASCADE,
    "clinic_id"      UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "patient_id"     UUID NOT NULL REFERENCES "patients"("id") ON DELETE CASCADE,
    "doctor_id"      UUID REFERENCES "profiles"("id") ON DELETE SET NULL,
    "rating"         SMALLINT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
    "comment"        TEXT,
    "status"         TEXT NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'approved', 'rejected')),
    "approved_by"    UUID REFERENCES "profiles"("id"),
    "approved_at"    TIMESTAMP,
    "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "appointment_reviews_clinic_status_idx"
    ON "appointment_reviews" ("clinic_id", "status");
CREATE INDEX IF NOT EXISTS "appointment_reviews_patient_id_idx"
    ON "appointment_reviews" ("patient_id");
CREATE INDEX IF NOT EXISTS "appointment_reviews_status_created_idx"
    ON "appointment_reviews" ("status", "created_at" DESC);

-- Row Level Security (defense-in-depth; the app reads/writes via Prisma with
-- a direct connection that bypasses RLS, gated at the action layer).
ALTER TABLE "appointment_reviews" ENABLE ROW LEVEL SECURITY;

-- Patients may read and create reviews for their own patient record.
DROP POLICY IF EXISTS appointment_reviews_patient_select ON "appointment_reviews";
CREATE POLICY appointment_reviews_patient_select ON "appointment_reviews"
    FOR SELECT TO authenticated
    USING (
        "patient_id" IN (
            SELECT p.id FROM patients p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS appointment_reviews_patient_insert ON "appointment_reviews";
CREATE POLICY appointment_reviews_patient_insert ON "appointment_reviews"
    FOR INSERT TO authenticated
    WITH CHECK (
        "patient_id" IN (
            SELECT p.id FROM patients p
            JOIN profiles pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

-- Clinic staff may read and moderate their own clinic's reviews.
DROP POLICY IF EXISTS appointment_reviews_clinic_select ON "appointment_reviews";
CREATE POLICY appointment_reviews_clinic_select ON "appointment_reviews"
    FOR SELECT TO authenticated
    USING ("clinic_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS appointment_reviews_clinic_update ON "appointment_reviews";
CREATE POLICY appointment_reviews_clinic_update ON "appointment_reviews"
    FOR UPDATE TO authenticated
    USING ("clinic_id" = auth.current_tenant_id());

-- Super admins may do anything.
DROP POLICY IF EXISTS appointment_reviews_super_admin ON "appointment_reviews";
CREATE POLICY appointment_reviews_super_admin ON "appointment_reviews"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());
