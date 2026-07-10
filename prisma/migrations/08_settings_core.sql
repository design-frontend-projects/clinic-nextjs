-- 08_settings_core.sql
-- Enterprise Global Settings Module — core tables.
-- Layered configuration: setting_definitions (typed catalog) + platform values
-- (existing "global_settings" table, keyed by definitions.key) + tenant_settings
-- + user_settings, with an append-only settings_history for versioning/rollback.
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the app code that
-- uses the settings Prisma models (this repo does not use prisma migrate).
-- Safe to re-run (idempotent DDL + ON CONFLICT seeds).

-- ---------------------------------------------------------------------------
-- 1. setting_definitions — typed catalog of every configurable key
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "setting_definitions" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "key"            TEXT NOT NULL,                 -- e.g. 'appointments.slot_duration_minutes'
    "module"         TEXT NOT NULL,                 -- 'organization'|'localization'|'branding'|'working_hours'|'appointments'|'notifications'|'billing'|'preferences'|'platform'
    "category"       TEXT NOT NULL,                 -- UI sub-grouping within a module
    "value_type"     TEXT NOT NULL CHECK ("value_type" IN ('string','number','boolean','enum','json','color','email','weekly_schedule')),
    "default_value"  JSONB NOT NULL,
    "validation"     JSONB,                         -- {"min":5,"max":240} | {"enum":[...]} | {"pattern":"..."}
    "allowed_scopes" TEXT[] NOT NULL DEFAULT '{platform,tenant}',  -- subset of platform|tenant|user
    "is_sensitive"   BOOLEAN NOT NULL DEFAULT FALSE,
    "is_public"      BOOLEAN NOT NULL DEFAULT FALSE, -- exposable on unauthenticated surfaces (public booking)
    "description"    TEXT,
    "display_order"  INTEGER NOT NULL DEFAULT 0,
    "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"     TIMESTAMP,
    "created_by"     UUID,
    "updated_by"     UUID,
    CONSTRAINT "setting_definitions_key_key" UNIQUE ("key")
);

CREATE INDEX IF NOT EXISTS "idx_setting_definitions_module" ON "setting_definitions" ("module", "display_order");

-- ---------------------------------------------------------------------------
-- 2. tenant_settings — per-clinic values
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "tenant_settings" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"       UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "definition_id"   UUID NOT NULL REFERENCES "setting_definitions"("id") ON DELETE CASCADE,
    "value"           JSONB NOT NULL,               -- for is_sensitive definitions this holds {"masked":true}
    "vault_secret_id" UUID,                          -- Supabase Vault secret reference (sensitive defs only)
    "version"         INTEGER NOT NULL DEFAULT 1,
    "is_active"       BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"      TIMESTAMP,
    "created_by"      UUID,
    "updated_by"      UUID,
    CONSTRAINT "tenant_settings_tenant_definition_key" UNIQUE ("tenant_id", "definition_id")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_settings_tenant" ON "tenant_settings" ("tenant_id");

-- ---------------------------------------------------------------------------
-- 3. user_settings — per-profile preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user_settings" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id"    UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "tenant_id"     UUID REFERENCES "clinics"("id") ON DELETE CASCADE,
    "definition_id" UUID NOT NULL REFERENCES "setting_definitions"("id") ON DELETE CASCADE,
    "value"         JSONB NOT NULL,
    "version"       INTEGER NOT NULL DEFAULT 1,
    "is_active"     BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"    TIMESTAMP,
    "created_by"    UUID,
    "updated_by"    UUID,
    CONSTRAINT "user_settings_profile_definition_key" UNIQUE ("profile_id", "definition_id")
);

CREATE INDEX IF NOT EXISTS "idx_user_settings_tenant_profile" ON "user_settings" ("tenant_id", "profile_id");

-- ---------------------------------------------------------------------------
-- 4. settings_history — append-only change log (all scopes), powers rollback
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "settings_history" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "scope"          TEXT NOT NULL CHECK ("scope" IN ('platform','tenant','user')),
    "tenant_id"      UUID REFERENCES "clinics"("id") ON DELETE CASCADE,   -- NULL for platform scope
    "profile_id"     UUID,                                                 -- set only for user scope
    "definition_key" TEXT NOT NULL,
    "old_value"      JSONB,                                                -- ALWAYS masked for sensitive definitions
    "new_value"      JSONB,
    "version"        INTEGER NOT NULL,
    "change_reason"  TEXT,
    "changed_by"     UUID,
    "changed_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "idx_settings_history_tenant_key"
    ON "settings_history" ("tenant_id", "definition_key", "changed_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_settings_history_scope_changed"
    ON "settings_history" ("scope", "changed_at" DESC);

-- ---------------------------------------------------------------------------
-- 5. Row Level Security (defense-in-depth; the app reads/writes via Prisma
--    with a direct connection that bypasses RLS, gated at the action layer).
-- ---------------------------------------------------------------------------
ALTER TABLE "setting_definitions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "tenant_settings"     ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_settings"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "settings_history"    ENABLE ROW LEVEL SECURITY;

-- Definitions: readable by any authenticated user; writes are platform-admin only.
DROP POLICY IF EXISTS setting_definitions_read ON "setting_definitions";
CREATE POLICY setting_definitions_read ON "setting_definitions"
    FOR SELECT TO authenticated USING (TRUE);

DROP POLICY IF EXISTS setting_definitions_write ON "setting_definitions";
CREATE POLICY setting_definitions_write ON "setting_definitions"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- Tenant settings: strict tenant isolation.
DROP POLICY IF EXISTS tenant_settings_tenant_isolation ON "tenant_settings";
CREATE POLICY tenant_settings_tenant_isolation ON "tenant_settings"
    FOR ALL TO authenticated
    USING ("tenant_id" = auth.current_tenant_id())
    WITH CHECK ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS tenant_settings_super_admin ON "tenant_settings";
CREATE POLICY tenant_settings_super_admin ON "tenant_settings"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- User settings: only the owning profile.
DROP POLICY IF EXISTS user_settings_owner ON "user_settings";
CREATE POLICY user_settings_owner ON "user_settings"
    FOR ALL TO authenticated
    USING ("profile_id" = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1))
    WITH CHECK ("profile_id" = (SELECT id FROM profiles WHERE auth_user_id = auth.uid() LIMIT 1));

-- History: append-only — SELECT + INSERT policies only, no UPDATE/DELETE for anyone.
DROP POLICY IF EXISTS settings_history_select ON "settings_history";
CREATE POLICY settings_history_select ON "settings_history"
    FOR SELECT TO authenticated
    USING ("tenant_id" = auth.current_tenant_id() OR auth.is_super_admin());

DROP POLICY IF EXISTS settings_history_insert ON "settings_history";
CREATE POLICY settings_history_insert ON "settings_history"
    FOR INSERT TO authenticated
    WITH CHECK ("tenant_id" = auth.current_tenant_id() OR auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 6. Seed setting definitions (deterministic UUIDs, safe to re-run)
-- ---------------------------------------------------------------------------
INSERT INTO "setting_definitions"
    ("id", "key", "module", "category", "value_type", "default_value", "validation", "allowed_scopes", "is_sensitive", "is_public", "description", "display_order")
VALUES
-- Organization
('d0100000-0000-0000-0000-000000000001', 'organization.display_name',  'organization', 'identity', 'string', '""'::jsonb, '{"maxLength":120}'::jsonb, '{tenant}', FALSE, TRUE,  'Clinic display name shown across the app and public pages', 10),
('d0100000-0000-0000-0000-000000000002', 'organization.legal_name',    'organization', 'identity', 'string', '""'::jsonb, '{"maxLength":200}'::jsonb, '{tenant}', FALSE, FALSE, 'Registered legal entity name used on invoices',            20),
('d0100000-0000-0000-0000-000000000003', 'organization.tax_number',    'organization', 'identity', 'string', '""'::jsonb, '{"maxLength":50}'::jsonb,  '{tenant}', FALSE, FALSE, 'Tax registration number printed on invoices',              30),
('d0100000-0000-0000-0000-000000000004', 'organization.address',       'organization', 'contact',  'string', '""'::jsonb, '{"maxLength":500}'::jsonb, '{tenant}', FALSE, TRUE,  'Physical address of the clinic',                            40),
('d0100000-0000-0000-0000-000000000005', 'organization.contact_email', 'organization', 'contact',  'email',  '""'::jsonb, NULL,                        '{tenant}', FALSE, TRUE,  'Public contact email address',                              50),
('d0100000-0000-0000-0000-000000000006', 'organization.contact_phone', 'organization', 'contact',  'string', '""'::jsonb, '{"maxLength":30}'::jsonb,  '{tenant}', FALSE, TRUE,  'Public contact phone number',                               60),
-- Localization
('d0200000-0000-0000-0000-000000000001', 'localization.default_language',  'localization', 'regional', 'enum',   '"en"'::jsonb,          '{"enum":["en","ar"]}'::jsonb, '{platform,tenant,user}', FALSE, TRUE,  'Default interface language',       10),
('d0200000-0000-0000-0000-000000000002', 'localization.timezone',          'localization', 'regional', 'string', '"UTC"'::jsonb,         '{"maxLength":64}'::jsonb,     '{platform,tenant,user}', FALSE, TRUE,  'IANA timezone identifier',         20),
('d0200000-0000-0000-0000-000000000003', 'localization.currency',          'localization', 'regional', 'string', '"USD"'::jsonb,         '{"pattern":"^[A-Z]{3}$"}'::jsonb, '{platform,tenant}',  FALSE, TRUE,  'ISO 4217 currency code',           30),
('d0200000-0000-0000-0000-000000000004', 'localization.date_format',       'localization', 'formats',  'enum',   '"DD/MM/YYYY"'::jsonb,  '{"enum":["DD/MM/YYYY","MM/DD/YYYY","YYYY-MM-DD"]}'::jsonb, '{platform,tenant,user}', FALSE, FALSE, 'Date display format',   40),
('d0200000-0000-0000-0000-000000000005', 'localization.time_format',       'localization', 'formats',  'enum',   '"12h"'::jsonb,         '{"enum":["12h","24h"]}'::jsonb, '{platform,tenant,user}', FALSE, FALSE, 'Time display format',            50),
('d0200000-0000-0000-0000-000000000006', 'localization.first_day_of_week', 'localization', 'formats',  'enum',   '"sunday"'::jsonb,      '{"enum":["saturday","sunday","monday"]}'::jsonb, '{platform,tenant}', FALSE, FALSE, 'First day of the calendar week', 60),
-- Branding
('d0300000-0000-0000-0000-000000000001', 'branding.logo_url',            'branding', 'visual', 'string', '""'::jsonb,        '{"maxLength":500}'::jsonb, '{tenant}', FALSE, TRUE,  'URL of the clinic logo image',            10),
('d0300000-0000-0000-0000-000000000002', 'branding.primary_color',       'branding', 'visual', 'color',  '"#0ea5e9"'::jsonb, NULL,                        '{tenant}', FALSE, TRUE,  'Primary brand color (hex)',               20),
('d0300000-0000-0000-0000-000000000003', 'branding.secondary_color',     'branding', 'visual', 'color',  '"#64748b"'::jsonb, NULL,                        '{tenant}', FALSE, TRUE,  'Secondary brand color (hex)',             30),
('d0300000-0000-0000-0000-000000000004', 'branding.invoice_footer_text', 'branding', 'documents', 'string', '""'::jsonb,     '{"maxLength":500}'::jsonb, '{tenant}', FALSE, FALSE, 'Footer text printed on invoices',         40),
-- Working hours
('d0400000-0000-0000-0000-000000000001', 'working_hours.schedule', 'working_hours', 'schedule', 'weekly_schedule',
 '{"monday":{"enabled":true,"start":"09:00","end":"17:00"},"tuesday":{"enabled":true,"start":"09:00","end":"17:00"},"wednesday":{"enabled":true,"start":"09:00","end":"17:00"},"thursday":{"enabled":true,"start":"09:00","end":"17:00"},"friday":{"enabled":true,"start":"09:00","end":"17:00"},"saturday":{"enabled":true,"start":"09:00","end":"17:00"},"sunday":{"enabled":false,"start":"09:00","end":"17:00"}}'::jsonb,
 NULL, '{tenant}', FALSE, TRUE, 'Weekly opening hours of the clinic', 10),
-- Appointments
('d0500000-0000-0000-0000-000000000001', 'appointments.slot_duration_minutes',      'appointments', 'scheduling', 'number',  '30'::jsonb,    '{"min":5,"max":240}'::jsonb,  '{tenant}', FALSE, TRUE,  'Length of one booking slot in minutes',                    10),
('d0500000-0000-0000-0000-000000000002', 'appointments.min_lead_time_hours',        'appointments', 'scheduling', 'number',  '1'::jsonb,     '{"min":0,"max":168}'::jsonb,  '{tenant}', FALSE, TRUE,  'Minimum hours before an appointment can be booked',        20),
('d0500000-0000-0000-0000-000000000003', 'appointments.max_advance_days',           'appointments', 'scheduling', 'number',  '90'::jsonb,    '{"min":1,"max":365}'::jsonb,  '{tenant}', FALSE, TRUE,  'How many days ahead appointments can be booked',           30),
('d0500000-0000-0000-0000-000000000004', 'appointments.cancellation_window_hours',  'appointments', 'policies',   'number',  '24'::jsonb,    '{"min":0,"max":168}'::jsonb,  '{tenant}', FALSE, TRUE,  'Hours before start time after which cancellation is blocked', 40),
('d0500000-0000-0000-0000-000000000005', 'appointments.allow_online_booking',       'appointments', 'policies',   'boolean', 'true'::jsonb,  NULL,                          '{tenant}', FALSE, TRUE,  'Whether patients can book online',                          50),
('d0500000-0000-0000-0000-000000000006', 'appointments.reminder_rules',             'appointments', 'reminders',  'json',    '[{"channel":"email","offset_hours":24}]'::jsonb, '{"itemKeys":["channel","offset_hours"]}'::jsonb, '{tenant}', FALSE, FALSE, 'Reminder rules: channel + hours before the appointment', 60),
-- Notifications
('d0600000-0000-0000-0000-000000000001', 'notifications.sender_name',       'notifications', 'general', 'string',  '""'::jsonb,   '{"maxLength":100}'::jsonb, '{tenant}', FALSE, FALSE, 'Sender name used on outbound notifications', 10),
('d0600000-0000-0000-0000-000000000002', 'notifications.reminders_enabled', 'notifications', 'general', 'boolean', 'true'::jsonb, NULL,                        '{tenant}', FALSE, FALSE, 'Master switch for appointment reminders',    20),
-- Billing
('d0700000-0000-0000-0000-000000000001', 'billing.tax_rate_percent', 'billing', 'tax',       'number', '0'::jsonb,  '{"min":0,"max":100}'::jsonb, '{tenant}', FALSE, FALSE, 'Default tax rate applied to invoices (%)', 10),
('d0700000-0000-0000-0000-000000000002', 'billing.invoice_due_days', 'billing', 'invoicing', 'number', '30'::jsonb, '{"min":0,"max":365}'::jsonb, '{tenant}', FALSE, FALSE, 'Days until an issued invoice is due',      20),
-- User preferences
('d0800000-0000-0000-0000-000000000001', 'preferences.theme', 'preferences', 'appearance', 'enum', '"system"'::jsonb, '{"enum":["light","dark","system"]}'::jsonb, '{user}', FALSE, FALSE, 'Preferred color theme', 10),
-- Platform (app-owner only)
('d0900000-0000-0000-0000-000000000001', 'platform.maintenance_mode',   'platform', 'operations', 'boolean', 'false'::jsonb, NULL,                          '{platform}', FALSE, FALSE, 'Puts the whole platform into maintenance mode', 10),
('d0900000-0000-0000-0000-000000000002', 'platform.support_email',      'platform', 'operations', 'email',   '""'::jsonb,    NULL,                          '{platform}', FALSE, TRUE,  'Support contact shown to tenants',              20),
('d0900000-0000-0000-0000-000000000003', 'platform.default_trial_days', 'platform', 'billing',    'number',  '14'::jsonb,    '{"min":0,"max":365}'::jsonb,  '{platform}', FALSE, FALSE, 'Trial length for newly created tenants',        30)
ON CONFLICT ("key") DO UPDATE SET
    "module"         = EXCLUDED."module",
    "category"       = EXCLUDED."category",
    "value_type"     = EXCLUDED."value_type",
    "validation"     = EXCLUDED."validation",
    "allowed_scopes" = EXCLUDED."allowed_scopes",
    "is_sensitive"   = EXCLUDED."is_sensitive",
    "is_public"      = EXCLUDED."is_public",
    "description"    = EXCLUDED."description",
    "display_order"  = EXCLUDED."display_order";

-- ---------------------------------------------------------------------------
-- 7. RBAC: settings permissions (new group under the Administration category)
-- ---------------------------------------------------------------------------
INSERT INTO "permission_groups" ("id", "name", "description") VALUES
('6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b', 'Settings & Configuration', 'All permissions relating to clinic configuration and settings')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "permissions" ("id", "name", "description", "category_id", "group_id") VALUES
('77777777-0000-0000-0000-000000000001', 'settings.core.read',            'Can view clinic settings',                        '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000002', 'settings.core.manage',          'Can edit clinic settings, import and export them', '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000003', 'settings.lookups.manage',       'Can manage lookup lists (appointment types, payment methods, ...)', '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000004', 'settings.notifications.manage', 'Can manage notification templates and channels',  '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000005', 'settings.sequences.manage',     'Can configure document numbering sequences',      '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000006', 'settings.history.read',         'Can view the settings change history',            '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000007', 'settings.history.rollback',     'Can roll settings back to a previous version',    '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b'),
('77777777-0000-0000-0000-000000000008', 'settings.features.read',        'Can view enabled feature flags',                  '4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '6b6b6b6b-6b6b-6b6b-6b6b-6b6b6b6b6b6b')
ON CONFLICT ("name") DO UPDATE SET "description" = EXCLUDED."description", "category_id" = EXCLUDED."category_id", "group_id" = EXCLUDED."group_id";

-- New tenants: auth.seed_tenant_default_rbac() already grants ALL permissions to
-- Super Admin / Tenant Owner / Administrator via "SELECT ... FROM permissions",
-- so the new settings.* permissions flow to those roles automatically.
-- Existing tenants: backfill the same grants (plus read-only settings access for
-- Manager) so already-seeded roles pick the new permissions up.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT id, tenant_id, name FROM "roles"
    WHERE "name" IN ('Super Admin', 'Tenant Owner', 'Administrator', 'Manager')
      AND "deleted_at" IS NULL
  LOOP
    IF r.name = 'Manager' THEN
      INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
      SELECT r.tenant_id, r.id, p.id FROM "permissions" p
      WHERE p."name" IN ('settings.core.read', 'settings.history.read', 'settings.features.read')
      ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO "role_permissions" ("tenant_id", "role_id", "permission_id")
      SELECT r.tenant_id, r.id, p.id FROM "permissions" p
      WHERE p."name" LIKE 'settings.%'
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;
