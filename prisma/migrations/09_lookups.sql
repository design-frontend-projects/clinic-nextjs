-- 09_lookups.sql
-- Reusable lookup system (categories + values) with tenant shadowing:
--   * rows with tenant_id NULL are the global defaults curated by the app owner
--   * a tenant row with the same code SHADOWS the global row for that tenant
--     (including is_active = FALSE to hide a global value)
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. lookup_categories
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "lookup_categories" (
    "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "code"                TEXT NOT NULL,             -- 'appointment_types'
    "name"                TEXT NOT NULL,
    "name_ar"             TEXT,
    "description"         TEXT,
    "allow_tenant_values" BOOLEAN NOT NULL DEFAULT TRUE,  -- FALSE = global-only, tenants cannot add/shadow
    "is_system"           BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = referenced by code, cannot be deleted
    "is_active"           BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"          TIMESTAMP,
    "created_by"          UUID,
    "updated_by"          UUID,
    CONSTRAINT "lookup_categories_code_key" UNIQUE ("code")
);

-- ---------------------------------------------------------------------------
-- 2. lookup_values
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "lookup_values" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "category_id"   UUID NOT NULL REFERENCES "lookup_categories"("id") ON DELETE CASCADE,
    "tenant_id"     UUID REFERENCES "clinics"("id") ON DELETE CASCADE,  -- NULL = global default
    "code"          TEXT NOT NULL,
    "label"         TEXT NOT NULL,
    "label_ar"      TEXT,
    "metadata"      JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"    TIMESTAMP,
    "created_by"    UUID,
    "updated_by"    UUID
);

-- Partial unique indexes (cannot be expressed in schema.prisma — the app
-- repository must use find-then-write inside a transaction, never upsert).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lookup_values_global"
    ON "lookup_values" ("category_id", "code") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lookup_values_tenant"
    ON "lookup_values" ("category_id", "tenant_id", "code") WHERE "tenant_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_lookup_values_category_tenant"
    ON "lookup_values" ("category_id", "tenant_id", "display_order");
CREATE INDEX IF NOT EXISTS "idx_lookup_values_tenant"
    ON "lookup_values" ("tenant_id");

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (defense-in-depth; app connection bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE "lookup_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "lookup_values"     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lookup_categories_read ON "lookup_categories";
CREATE POLICY lookup_categories_read ON "lookup_categories"
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS lookup_categories_write ON "lookup_categories";
CREATE POLICY lookup_categories_write ON "lookup_categories"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- Values: everyone reads globals + their own tenant's rows; tenants write only
-- their own rows; super admins manage everything (incl. globals).
DROP POLICY IF EXISTS lookup_values_read ON "lookup_values";
CREATE POLICY lookup_values_read ON "lookup_values"
    FOR SELECT TO authenticated
    USING ("tenant_id" IS NULL OR "tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS lookup_values_tenant_insert ON "lookup_values";
CREATE POLICY lookup_values_tenant_insert ON "lookup_values"
    FOR INSERT TO authenticated
    WITH CHECK ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS lookup_values_tenant_update ON "lookup_values";
CREATE POLICY lookup_values_tenant_update ON "lookup_values"
    FOR UPDATE TO authenticated
    USING ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS lookup_values_tenant_delete ON "lookup_values";
CREATE POLICY lookup_values_tenant_delete ON "lookup_values"
    FOR DELETE TO authenticated
    USING ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS lookup_values_super_admin ON "lookup_values";
CREATE POLICY lookup_values_super_admin ON "lookup_values"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. Seed categories (deterministic UUIDs) + bilingual global values
-- ---------------------------------------------------------------------------
INSERT INTO "lookup_categories" ("id", "code", "name", "name_ar", "description", "allow_tenant_values", "is_system") VALUES
('1c000000-0000-0000-0000-000000000001', 'appointment_types',    'Appointment Types',    'أنواع المواعيد',    'Kinds of visits patients can book',                 TRUE,  TRUE),
('1c000000-0000-0000-0000-000000000002', 'cancellation_reasons', 'Cancellation Reasons', 'أسباب الإلغاء',     'Reasons recorded when an appointment is cancelled', TRUE,  TRUE),
('1c000000-0000-0000-0000-000000000003', 'payment_methods',      'Payment Methods',      'طرق الدفع',         'Accepted payment methods at the clinic',            TRUE,  TRUE),
('1c000000-0000-0000-0000-000000000004', 'document_types',       'Document Types',       'أنواع المستندات',   'Document kinds used by numbering sequences',        FALSE, TRUE),
('1c000000-0000-0000-0000-000000000005', 'referral_sources',     'Referral Sources',     'مصادر الإحالة',     'How the patient heard about the clinic',            TRUE,  FALSE)
ON CONFLICT ("code") DO UPDATE SET
    "name" = EXCLUDED."name",
    "name_ar" = EXCLUDED."name_ar",
    "description" = EXCLUDED."description",
    "allow_tenant_values" = EXCLUDED."allow_tenant_values",
    "is_system" = EXCLUDED."is_system";

INSERT INTO "lookup_values" ("category_id", "tenant_id", "code", "label", "label_ar", "display_order") VALUES
-- Appointment types
('1c000000-0000-0000-0000-000000000001', NULL, 'consultation', 'Consultation', 'استشارة',      10),
('1c000000-0000-0000-0000-000000000001', NULL, 'follow_up',    'Follow-up',    'متابعة',       20),
('1c000000-0000-0000-0000-000000000001', NULL, 'procedure',    'Procedure',    'إجراء طبي',    30),
('1c000000-0000-0000-0000-000000000001', NULL, 'emergency',    'Emergency',    'طوارئ',        40),
-- Cancellation reasons
('1c000000-0000-0000-0000-000000000002', NULL, 'patient_request', 'Patient request',   'طلب المريض',       10),
('1c000000-0000-0000-0000-000000000002', NULL, 'doctor_unavailable', 'Doctor unavailable', 'عدم توفر الطبيب', 20),
('1c000000-0000-0000-0000-000000000002', NULL, 'no_show',         'No show',           'عدم الحضور',       30),
('1c000000-0000-0000-0000-000000000002', NULL, 'other',           'Other',             'أخرى',             40),
-- Payment methods
('1c000000-0000-0000-0000-000000000003', NULL, 'cash',          'Cash',          'نقدي',           10),
('1c000000-0000-0000-0000-000000000003', NULL, 'card',          'Card',          'بطاقة',          20),
('1c000000-0000-0000-0000-000000000003', NULL, 'bank_transfer', 'Bank transfer', 'تحويل بنكي',     30),
('1c000000-0000-0000-0000-000000000003', NULL, 'insurance',     'Insurance',     'تأمين',          40),
('1c000000-0000-0000-0000-000000000003', NULL, 'mobile_wallet', 'Mobile wallet', 'محفظة إلكترونية', 50),
-- Document types (global-only; consumed by document_sequences)
('1c000000-0000-0000-0000-000000000004', NULL, 'invoice',      'Invoice',        'فاتورة',       10),
('1c000000-0000-0000-0000-000000000004', NULL, 'receipt',      'Receipt',        'إيصال',        20),
('1c000000-0000-0000-0000-000000000004', NULL, 'patient_file', 'Patient file',   'ملف مريض',     30),
('1c000000-0000-0000-0000-000000000004', NULL, 'lab_order',    'Lab order',      'طلب مختبر',    40),
-- Referral sources
('1c000000-0000-0000-0000-000000000005', NULL, 'walk_in',        'Walk-in',          'زيارة مباشرة',    10),
('1c000000-0000-0000-0000-000000000005', NULL, 'friend_family',  'Friend or family', 'صديق أو قريب',    20),
('1c000000-0000-0000-0000-000000000005', NULL, 'social_media',   'Social media',     'وسائل التواصل',   30),
('1c000000-0000-0000-0000-000000000005', NULL, 'doctor_referral','Doctor referral',  'إحالة طبيب',      40),
('1c000000-0000-0000-0000-000000000005', NULL, 'online_search',  'Online search',    'بحث على الإنترنت', 50)
ON CONFLICT ("category_id", "code") WHERE "tenant_id" IS NULL DO NOTHING;
