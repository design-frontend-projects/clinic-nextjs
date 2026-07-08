-- 05_specialties.sql
-- Global medical-specialties catalog (curated by the app owner) plus the
-- junction linking a doctor profile to one or more specialties.

-- 1. Specialties catalog (global, not tenant-scoped)
CREATE TABLE IF NOT EXISTS "specialties" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(255) NOT NULL UNIQUE,
    "name_ar" VARCHAR(255),
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,
    "updated_by" UUID
);

CREATE INDEX IF NOT EXISTS "specialties_is_active_idx" ON "specialties" ("is_active");

-- 2. Doctor <-> specialty junction
CREATE TABLE IF NOT EXISTS "doctor_specialties" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "specialty_id" UUID NOT NULL REFERENCES "specialties"("id") ON DELETE CASCADE,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "doctor_specialties_profile_specialty_key" UNIQUE ("profile_id", "specialty_id")
);

CREATE INDEX IF NOT EXISTS "doctor_specialties_profile_id_idx" ON "doctor_specialties" ("profile_id");
CREATE INDEX IF NOT EXISTS "doctor_specialties_specialty_id_idx" ON "doctor_specialties" ("specialty_id");

-- 3. Row Level Security
-- The catalog is readable by any authenticated user (needed during onboarding);
-- writes are performed by the app-owner server actions (app-level gate + service role).
ALTER TABLE "specialties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "doctor_specialties" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS specialties_read ON "specialties";
CREATE POLICY specialties_read ON "specialties"
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS specialties_write ON "specialties";
CREATE POLICY specialties_write ON "specialties"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- A doctor can see/manage only their own specialty links; app actions run with service role.
DROP POLICY IF EXISTS doctor_specialties_owner ON "doctor_specialties";
CREATE POLICY doctor_specialties_owner ON "doctor_specialties"
    FOR ALL TO authenticated
    USING (
        "profile_id" = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1)
    );

-- 4. Seed common specialties (English + Arabic). Safe to re-run.
INSERT INTO "specialties" ("name", "name_ar", "display_order") VALUES
    ('General Practice',   'طب عام',                    10),
    ('Internal Medicine',  'الباطنة',                   20),
    ('Cardiology',         'أمراض القلب',               30),
    ('Dermatology',        'الجلدية',                   40),
    ('Pediatrics',         'الأطفال',                   50),
    ('Orthopedics',        'العظام',                    60),
    ('Neurology',          'المخ والأعصاب',             70),
    ('ENT',                'الأنف والأذن والحنجرة',     80),
    ('Ophthalmology',      'العيون',                    90),
    ('Gynecology',         'النساء والولادة',           100),
    ('Psychiatry',         'النفسية',                   110),
    ('Dentistry',          'الأسنان',                   120),
    ('Urology',            'المسالك البولية',           130),
    ('Gastroenterology',   'الجهاز الهضمي',             140),
    ('Endocrinology',      'الغدد الصماء',              150)
ON CONFLICT ("name") DO NOTHING;
