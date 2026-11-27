-- 32_clinic_specialty_and_body_charts.sql
-- Adds:
--   1. specialties.diagram_key to map each medical specialty to an interactive
--      anatomical SVG template (backfilled for all 15 seeded specialties).
--   2. Public (anon) read policy for active specialties on the sign-up page.
--   3. clinics.specialty_id linking each clinic/tenant to a primary specialty.
--   4. patient_body_charts table storing canonical structured JSON (chart_data)
--      plus a self-contained animated SVG snapshot (animated_svg) per visit
--      version, with tenant-scoped & patient-portal RLS policies.

-- 1. Specialty -> diagram template mapping
ALTER TABLE public."specialties"
    ADD COLUMN IF NOT EXISTS "diagram_key" VARCHAR(64) NOT NULL DEFAULT 'general_body';

UPDATE public."specialties"
SET "diagram_key" = CASE LOWER(TRIM("name"))
    WHEN 'general practice'   THEN 'general_practice'
    WHEN 'internal medicine'  THEN 'internal_medicine'
    WHEN 'cardiology'         THEN 'cardiology'
    WHEN 'dermatology'        THEN 'dermatology'
    WHEN 'pediatrics'         THEN 'pediatrics'
    WHEN 'orthopedics'        THEN 'orthopedics'
    WHEN 'neurology'          THEN 'neurology'
    WHEN 'ent'                THEN 'ent'
    WHEN 'ophthalmology'      THEN 'ophthalmology'
    WHEN 'gynecology'         THEN 'gynecology'
    WHEN 'psychiatry'         THEN 'psychiatry'
    WHEN 'dentistry'          THEN 'dentistry'
    WHEN 'urology'            THEN 'urology'
    WHEN 'gastroenterology'   THEN 'gastroenterology'
    WHEN 'endocrinology'      THEN 'endocrinology'
    ELSE COALESCE(NULLIF("diagram_key", ''), 'general_body')
END;

DROP POLICY IF EXISTS specialties_public_read ON public."specialties";
CREATE POLICY specialties_public_read ON public."specialties"
    FOR SELECT TO anon USING ("is_active" = TRUE);

-- 2. Primary specialty on clinics
ALTER TABLE public."clinics"
    ADD COLUMN IF NOT EXISTS "specialty_id" UUID REFERENCES public."specialties"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "clinics_specialty_id_idx"
    ON public."clinics" ("specialty_id");

-- 3. Longitudinal patient body charts (JSONB + Animated SVG snapshots)
CREATE TABLE IF NOT EXISTS public."patient_body_charts" (
    "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "clinic_id"          UUID NOT NULL REFERENCES public."clinics"("id") ON DELETE CASCADE,
    "branch_id"          UUID REFERENCES public."branches"("id") ON DELETE SET NULL,
    "patient_id"         UUID NOT NULL REFERENCES public."patients"("id") ON DELETE CASCADE,
    "specialty_id"       UUID REFERENCES public."specialties"("id") ON DELETE SET NULL,
    "diagram_key"        VARCHAR(64) NOT NULL,
    "encounter_id"       UUID REFERENCES public."encounters"("id") ON DELETE SET NULL,
    "appointment_id"     UUID REFERENCES public."appointments"("id") ON DELETE SET NULL,
    "doctor_id"          UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
    "version"            INTEGER NOT NULL DEFAULT 1,
    "title"              VARCHAR(255),
    "overall_notes"      TEXT,
    "chart_data"         JSONB NOT NULL DEFAULT '{}'::jsonb,
    "animated_svg"       TEXT NOT NULL,
    "share_with_patient" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"         TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "patient_body_charts_clinic_patient_diagram_ver_idx"
    ON public."patient_body_charts" ("clinic_id", "patient_id", "diagram_key", "version" DESC);

CREATE INDEX IF NOT EXISTS "patient_body_charts_patient_created_idx"
    ON public."patient_body_charts" ("patient_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "patient_body_charts_encounter_idx"
    ON public."patient_body_charts" ("encounter_id");

CREATE INDEX IF NOT EXISTS "patient_body_charts_clinic_updated_idx"
    ON public."patient_body_charts" ("clinic_id", "updated_at", "id");

-- 4. Row Level Security (inline auth.uid() expressions compatible with Supabase)
ALTER TABLE public."patient_body_charts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_body_charts_clinic_all ON public."patient_body_charts";
CREATE POLICY patient_body_charts_clinic_all ON public."patient_body_charts"
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."clinics" c
            WHERE c.id = "patient_body_charts"."clinic_id"
              AND c.auth_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public."profiles" pr
            WHERE pr.auth_user_id = auth.uid()
              AND pr.role <> 'patient'
              AND (
                  pr.tenant_id = "patient_body_charts"."clinic_id"
                  OR pr.clinic_id = "patient_body_charts"."clinic_id"
              )
        )
        OR EXISTS (
            SELECT 1 FROM public."profile_branches" pb
            JOIN public."profiles" pr ON pr.id = pb.profile_id
            WHERE pr.auth_user_id = auth.uid()
              AND pb.clinic_id = "patient_body_charts"."clinic_id"
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public."clinics" c
            WHERE c.id = "patient_body_charts"."clinic_id"
              AND c.auth_user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public."profiles" pr
            WHERE pr.auth_user_id = auth.uid()
              AND pr.role <> 'patient'
              AND (
                  pr.tenant_id = "patient_body_charts"."clinic_id"
                  OR pr.clinic_id = "patient_body_charts"."clinic_id"
              )
        )
        OR EXISTS (
            SELECT 1 FROM public."profile_branches" pb
            JOIN public."profiles" pr ON pr.id = pb.profile_id
            WHERE pr.auth_user_id = auth.uid()
              AND pb.clinic_id = "patient_body_charts"."clinic_id"
        )
    );

DROP POLICY IF EXISTS patient_body_charts_patient_select ON public."patient_body_charts";
CREATE POLICY patient_body_charts_patient_select ON public."patient_body_charts"
    FOR SELECT TO authenticated
    USING (
        "share_with_patient" = TRUE
        AND "deleted_at" IS NULL
        AND "patient_id" IN (
            SELECT p.id FROM public."patients" p
            JOIN public."profiles" pr ON pr.id = p.profile_id
            WHERE pr.auth_user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS patient_body_charts_super_admin ON public."patient_body_charts";
CREATE POLICY patient_body_charts_super_admin ON public."patient_body_charts"
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public."profiles" pr
            WHERE pr.auth_user_id = auth.uid()
              AND pr.role IN ('app_owner', 'super_admin')
        )
    );
