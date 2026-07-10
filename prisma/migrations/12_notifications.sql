-- 12_notifications.sql
-- Notification templates (global defaults + tenant overrides) and per-tenant
-- channel configuration (SMTP / SMS / WhatsApp / webhook) with secrets stored
-- in Supabase Vault — the table holds only the vault secret UUID (secret_ref).
--
-- Template resolution fallback (implemented in template.service.ts):
--   tenant+locale  >  tenant+'en'  >  global+locale  >  global+'en'
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. notification_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_templates" (
    "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"    UUID REFERENCES "clinics"("id") ON DELETE CASCADE,  -- NULL = global default
    "channel"      TEXT NOT NULL CHECK ("channel" IN ('email','sms','whatsapp','in_app')),
    "template_key" TEXT NOT NULL,               -- 'appointment.reminder','appointment.confirmed',...
    "locale"       TEXT NOT NULL DEFAULT 'en',
    "subject"      TEXT,                        -- email only
    "body"         TEXT NOT NULL,               -- {{placeholder}} variables
    "variables"    JSONB,                       -- declared placeholders, for UI hints + validation
    "is_active"    BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"   TIMESTAMP,
    "created_by"   UUID,
    "updated_by"   UUID
);

-- Partial unique indexes (not expressible in schema.prisma — repository uses
-- find-then-write inside a transaction).
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_templates_global"
    ON "notification_templates" ("channel", "template_key", "locale") WHERE "tenant_id" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notification_templates_tenant"
    ON "notification_templates" ("tenant_id", "channel", "template_key", "locale") WHERE "tenant_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "idx_notification_templates_tenant"
    ON "notification_templates" ("tenant_id", "template_key");

-- ---------------------------------------------------------------------------
-- 2. notification_channels — per-tenant delivery configuration
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notification_channels" (
    "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"        UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "channel_type"     TEXT NOT NULL CHECK ("channel_type" IN ('smtp','twilio_sms','whatsapp','webhook')),
    "config"           JSONB NOT NULL DEFAULT '{}',  -- NON-secret fields only (host, port, from_address, username, ...)
    "secret_ref"       UUID,                          -- Supabase Vault secret id (password / API key)
    "is_enabled"       BOOLEAN NOT NULL DEFAULT FALSE,
    "is_verified"      BOOLEAN NOT NULL DEFAULT FALSE,
    "last_verified_at" TIMESTAMP,
    "is_active"        BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"       TIMESTAMP,
    "created_by"       UUID,
    "updated_by"       UUID,
    CONSTRAINT "notification_channels_tenant_type_key" UNIQUE ("tenant_id", "channel_type")
);

CREATE INDEX IF NOT EXISTS "idx_notification_channels_tenant"
    ON "notification_channels" ("tenant_id");

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (defense-in-depth; app connection bypasses RLS).
--    No policy ever exposes vault contents; secret_ref is only a UUID.
-- ---------------------------------------------------------------------------
ALTER TABLE "notification_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "notification_channels"  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_templates_read ON "notification_templates";
CREATE POLICY notification_templates_read ON "notification_templates"
    FOR SELECT TO authenticated
    USING ("tenant_id" IS NULL OR "tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS notification_templates_tenant_insert ON "notification_templates";
CREATE POLICY notification_templates_tenant_insert ON "notification_templates"
    FOR INSERT TO authenticated
    WITH CHECK ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS notification_templates_tenant_update ON "notification_templates";
CREATE POLICY notification_templates_tenant_update ON "notification_templates"
    FOR UPDATE TO authenticated
    USING ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS notification_templates_tenant_delete ON "notification_templates";
CREATE POLICY notification_templates_tenant_delete ON "notification_templates"
    FOR DELETE TO authenticated
    USING ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS notification_templates_super_admin ON "notification_templates";
CREATE POLICY notification_templates_super_admin ON "notification_templates"
    FOR ALL TO authenticated USING (auth.is_super_admin());

DROP POLICY IF EXISTS notification_channels_tenant_isolation ON "notification_channels";
CREATE POLICY notification_channels_tenant_isolation ON "notification_channels"
    FOR ALL TO authenticated
    USING ("tenant_id" = auth.current_tenant_id())
    WITH CHECK ("tenant_id" = auth.current_tenant_id());

DROP POLICY IF EXISTS notification_channels_super_admin ON "notification_channels";
CREATE POLICY notification_channels_super_admin ON "notification_channels"
    FOR ALL TO authenticated USING (auth.is_super_admin());

-- ---------------------------------------------------------------------------
-- 4. Supabase Vault grants for the application role.
--    RISK: if DATABASE_URL uses a role without vault access, the settings
--    module falls back to the ISecretStore AES-GCM implementation (see
--    src/features/settings/services/vault.service.ts). Adjust the role name
--    below to match the role in your DATABASE_URL (usually "postgres").
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'vault') THEN
    BEGIN
      GRANT USAGE ON SCHEMA vault TO postgres;
      GRANT SELECT, DELETE ON vault.secrets TO postgres;
      GRANT SELECT ON vault.decrypted_secrets TO postgres;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA vault TO postgres;
      RAISE NOTICE 'Vault grants applied to role "postgres".';
    EXCEPTION WHEN insufficient_privilege THEN
      RAISE NOTICE 'Insufficient privilege to grant vault access — run this block as supabase_admin, or use the AES-GCM secret store fallback.';
    END;
  ELSE
    RAISE NOTICE 'Vault schema not found — enable the Vault extension in Supabase, or use the AES-GCM secret store fallback.';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Seed global templates (en + ar, email + sms). Deterministic conflict
--    target = the global partial unique index.
-- ---------------------------------------------------------------------------
INSERT INTO "notification_templates" ("tenant_id", "channel", "template_key", "locale", "subject", "body", "variables") VALUES
-- appointment.reminder
(NULL, 'email', 'appointment.reminder', 'en', 'Appointment reminder — {{clinic_name}}',
 'Dear {{patient_name}},\n\nThis is a reminder of your appointment at {{clinic_name}} on {{appointment_date}} at {{appointment_time}} with {{doctor_name}}.\n\nIf you need to reschedule, please contact us at {{clinic_phone}}.',
 '["patient_name","clinic_name","appointment_date","appointment_time","doctor_name","clinic_phone"]'::jsonb),
(NULL, 'email', 'appointment.reminder', 'ar', 'تذكير بالموعد — {{clinic_name}}',
 'عزيزي {{patient_name}}،\n\nنذكركم بموعدكم في {{clinic_name}} بتاريخ {{appointment_date}} الساعة {{appointment_time}} مع {{doctor_name}}.\n\nلإعادة الجدولة، يرجى الاتصال بنا على {{clinic_phone}}.',
 '["patient_name","clinic_name","appointment_date","appointment_time","doctor_name","clinic_phone"]'::jsonb),
(NULL, 'sms', 'appointment.reminder', 'en', NULL,
 'Reminder: appointment at {{clinic_name}} on {{appointment_date}} {{appointment_time}}.',
 '["clinic_name","appointment_date","appointment_time"]'::jsonb),
(NULL, 'sms', 'appointment.reminder', 'ar', NULL,
 'تذكير: موعدكم في {{clinic_name}} بتاريخ {{appointment_date}} {{appointment_time}}.',
 '["clinic_name","appointment_date","appointment_time"]'::jsonb),
-- appointment.confirmed
(NULL, 'email', 'appointment.confirmed', 'en', 'Appointment confirmed — {{clinic_name}}',
 'Dear {{patient_name}},\n\nYour appointment at {{clinic_name}} is confirmed for {{appointment_date}} at {{appointment_time}} with {{doctor_name}}.',
 '["patient_name","clinic_name","appointment_date","appointment_time","doctor_name"]'::jsonb),
(NULL, 'email', 'appointment.confirmed', 'ar', 'تأكيد الموعد — {{clinic_name}}',
 'عزيزي {{patient_name}}،\n\nتم تأكيد موعدكم في {{clinic_name}} بتاريخ {{appointment_date}} الساعة {{appointment_time}} مع {{doctor_name}}.',
 '["patient_name","clinic_name","appointment_date","appointment_time","doctor_name"]'::jsonb),
(NULL, 'sms', 'appointment.confirmed', 'en', NULL,
 'Confirmed: {{clinic_name}} on {{appointment_date}} {{appointment_time}}.',
 '["clinic_name","appointment_date","appointment_time"]'::jsonb),
(NULL, 'sms', 'appointment.confirmed', 'ar', NULL,
 'تم التأكيد: {{clinic_name}} بتاريخ {{appointment_date}} {{appointment_time}}.',
 '["clinic_name","appointment_date","appointment_time"]'::jsonb),
-- appointment.cancelled
(NULL, 'email', 'appointment.cancelled', 'en', 'Appointment cancelled — {{clinic_name}}',
 'Dear {{patient_name}},\n\nYour appointment at {{clinic_name}} on {{appointment_date}} at {{appointment_time}} has been cancelled. Please contact us at {{clinic_phone}} to rebook.',
 '["patient_name","clinic_name","appointment_date","appointment_time","clinic_phone"]'::jsonb),
(NULL, 'email', 'appointment.cancelled', 'ar', 'إلغاء الموعد — {{clinic_name}}',
 'عزيزي {{patient_name}}،\n\nتم إلغاء موعدكم في {{clinic_name}} بتاريخ {{appointment_date}} الساعة {{appointment_time}}. يرجى الاتصال بنا على {{clinic_phone}} لإعادة الحجز.',
 '["patient_name","clinic_name","appointment_date","appointment_time","clinic_phone"]'::jsonb),
(NULL, 'sms', 'appointment.cancelled', 'en', NULL,
 'Cancelled: your appointment at {{clinic_name}} on {{appointment_date}}. Call {{clinic_phone}} to rebook.',
 '["clinic_name","appointment_date","clinic_phone"]'::jsonb),
(NULL, 'sms', 'appointment.cancelled', 'ar', NULL,
 'تم الإلغاء: موعدكم في {{clinic_name}} بتاريخ {{appointment_date}}. اتصلوا على {{clinic_phone}} لإعادة الحجز.',
 '["clinic_name","appointment_date","clinic_phone"]'::jsonb),
-- invoice.created
(NULL, 'email', 'invoice.created', 'en', 'Invoice {{invoice_number}} — {{clinic_name}}',
 'Dear {{patient_name}},\n\nInvoice {{invoice_number}} for {{invoice_total}} {{currency}} has been issued by {{clinic_name}}. Due date: {{due_date}}.',
 '["patient_name","clinic_name","invoice_number","invoice_total","currency","due_date"]'::jsonb),
(NULL, 'email', 'invoice.created', 'ar', 'فاتورة {{invoice_number}} — {{clinic_name}}',
 'عزيزي {{patient_name}}،\n\nتم إصدار الفاتورة {{invoice_number}} بمبلغ {{invoice_total}} {{currency}} من {{clinic_name}}. تاريخ الاستحقاق: {{due_date}}.',
 '["patient_name","clinic_name","invoice_number","invoice_total","currency","due_date"]'::jsonb),
(NULL, 'sms', 'invoice.created', 'en', NULL,
 'Invoice {{invoice_number}}: {{invoice_total}} {{currency}} from {{clinic_name}}.',
 '["invoice_number","invoice_total","currency","clinic_name"]'::jsonb),
(NULL, 'sms', 'invoice.created', 'ar', NULL,
 'فاتورة {{invoice_number}}: {{invoice_total}} {{currency}} من {{clinic_name}}.',
 '["invoice_number","invoice_total","currency","clinic_name"]'::jsonb)
ON CONFLICT ("channel", "template_key", "locale") WHERE "tenant_id" IS NULL DO NOTHING;
