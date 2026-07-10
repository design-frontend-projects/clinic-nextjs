-- 10_feature_flags.sql
-- Feature flag catalog + per-tenant overrides.
-- Evaluation chain (implemented in src/lib/features.ts):
--   kill_switch  >  tenant override (unexpired)  >  plan entitlement
--   (subscription_features — enforced for the first time)  >  flag default.
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. feature_flags — platform-owned catalog
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key"             TEXT NOT NULL,               -- 'online_booking'
    "name"            TEXT NOT NULL,
    "name_ar"         TEXT,
    "description"     TEXT,
    "default_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "kill_switch"     BOOLEAN NOT NULL DEFAULT FALSE,   -- TRUE = off for everyone, overrides all layers
    "environments"    TEXT[] NOT NULL DEFAULT '{production,development}',
    "is_beta"         BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"      TIMESTAMP,
    "created_by"      UUID,
    "updated_by"      UUID,
    CONSTRAINT "feature_flags_key_key" UNIQUE ("key")
);

-- ---------------------------------------------------------------------------
-- 2. tenant_feature_overrides — app-owner-granted per-tenant exceptions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenant_feature_overrides" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "feature_key" TEXT NOT NULL REFERENCES "feature_flags"("key") ON DELETE CASCADE,
    "is_enabled"  BOOLEAN NOT NULL,
    "reason"      TEXT,
    "expires_at"  TIMESTAMP,                        -- NULL = permanent
    "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"  TIMESTAMP,
    "created_by"  UUID,
    "updated_by"  UUID,
    CONSTRAINT "tenant_feature_overrides_tenant_feature_key" UNIQUE ("tenant_id", "feature_key")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_feature_overrides_tenant"
    ON "tenant_feature_overrides" ("tenant_id");

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (defense-in-depth; app connection bypasses RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE "feature_flags"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_feature_overrides" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feature_flags_read ON "feature_flags";
CREATE POLICY feature_flags_read ON "feature_flags"
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS feature_flags_write ON "feature_flags";
CREATE POLICY feature_flags_write ON "feature_flags"
    FOR ALL TO authenticated USING (auth.is_super_admin());

DROP POLICY IF EXISTS tenant_feature_overrides_read ON "tenant_feature_overrides";
CREATE POLICY tenant_feature_overrides_read ON "tenant_feature_overrides"
    FOR SELECT TO authenticated
    USING ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS tenant_feature_overrides_admin ON "tenant_feature_overrides";
CREATE POLICY tenant_feature_overrides_admin ON "tenant_feature_overrides"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. Seed flags (deterministic UUIDs)
-- ---------------------------------------------------------------------------
INSERT INTO "feature_flags" ("id", "key", "name", "name_ar", "description", "default_enabled", "is_beta") VALUES
('1f000000-0000-0000-0000-000000000001', 'pharmacy',               'Pharmacy Module',        'وحدة الصيدلية',      'Pharmacy inventory, dispensing and sales',                 TRUE,  FALSE),
('1f000000-0000-0000-0000-000000000002', 'lab',                    'Laboratory Module',      'وحدة المختبر',       'Lab orders and results',                                   TRUE,  FALSE),
('1f000000-0000-0000-0000-000000000003', 'online_booking',         'Online Booking',         'الحجز الإلكتروني',   'Patients can book appointments online',                    TRUE,  FALSE),
('1f000000-0000-0000-0000-000000000004', 'sms_reminders',          'SMS Reminders',          'تذكيرات SMS',        'Appointment reminders via SMS',                            FALSE, FALSE),
('1f000000-0000-0000-0000-000000000005', 'whatsapp_notifications', 'WhatsApp Notifications', 'إشعارات واتساب',     'Notifications delivered over WhatsApp',                    FALSE, TRUE),
('1f000000-0000-0000-0000-000000000006', 'advanced_reports',       'Advanced Reports',       'التقارير المتقدمة',  'Advanced analytics and exportable reports',                FALSE, FALSE),
('1f000000-0000-0000-0000-000000000007', 'api_access',             'API Access',             'الوصول عبر API',     'Programmatic API access for integrations',                 FALSE, TRUE)
ON CONFLICT ("key") DO UPDATE SET
    "name" = EXCLUDED."name",
    "name_ar" = EXCLUDED."name_ar",
    "description" = EXCLUDED."description",
    "is_beta" = EXCLUDED."is_beta";

-- ---------------------------------------------------------------------------
-- 5. Plan entitlements — make subscription_features real.
--    Matches existing plans by name (case-insensitive). Plans created later
--    get entitlements through the app-owner plan editor.
-- ---------------------------------------------------------------------------
-- Every plan gets the base modules.
INSERT INTO "subscription_features" ("plan_id", "feature_name", "is_enabled")
SELECT p."id", f.feature, TRUE
FROM "subscription_plans" p
CROSS JOIN (VALUES ('pharmacy'), ('lab'), ('online_booking')) AS f(feature)
WHERE p."deleted_at" IS NULL
ON CONFLICT ("plan_id", "feature_name") DO NOTHING;

-- Pro-tier plans (and above) add SMS reminders + advanced reports.
INSERT INTO "subscription_features" ("plan_id", "feature_name", "is_enabled")
SELECT p."id", f.feature, TRUE
FROM "subscription_plans" p
CROSS JOIN (VALUES ('sms_reminders'), ('advanced_reports')) AS f(feature)
WHERE p."deleted_at" IS NULL
  AND (p."name" ILIKE '%pro%' OR p."name" ILIKE '%enterprise%')
ON CONFLICT ("plan_id", "feature_name") DO NOTHING;

-- Enterprise-tier plans add WhatsApp + API access.
INSERT INTO "subscription_features" ("plan_id", "feature_name", "is_enabled")
SELECT p."id", f.feature, TRUE
FROM "subscription_plans" p
CROSS JOIN (VALUES ('whatsapp_notifications'), ('api_access')) AS f(feature)
WHERE p."deleted_at" IS NULL
  AND p."name" ILIKE '%enterprise%'
ON CONFLICT ("plan_id", "feature_name") DO NOTHING;
