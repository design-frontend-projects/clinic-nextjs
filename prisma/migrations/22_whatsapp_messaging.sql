-- 22_whatsapp_messaging.sql
-- Outbound WhatsApp (via the WAHA gateway): reusable per-tenant message
-- templates + a delivery log. Distinct from 12_notifications.sql (channel
-- config scaffolding) and 13_in_app_notifications.sql (in-app inbox).
--
-- A single "send" fans out to N recipients sharing one `group_id`; each
-- recipient is one row in `whatsapp_messages` recording its own status.
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. whatsapp_templates — per-tenant reusable message bodies with {{vars}}
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "whatsapp_templates" (
    "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"   UUID NOT NULL REFERENCES "clinics"("id") ON DELETE CASCADE,
    "key"         TEXT NOT NULL,                 -- stable id, e.g. 'appointment.reminder'
    "name"        TEXT NOT NULL,                 -- human label for the picker
    "body_en"     TEXT NOT NULL,                 -- may contain {{placeholder}} tokens
    "body_ar"     TEXT,
    "variables"   JSONB NOT NULL DEFAULT '[]',   -- declared placeholder names
    "is_active"   BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"  UUID,
    CONSTRAINT "whatsapp_templates_tenant_key_key" UNIQUE ("tenant_id", "key")
);

CREATE INDEX IF NOT EXISTS "idx_whatsapp_templates_tenant"
    ON "whatsapp_templates" ("tenant_id", "is_active");

-- ---------------------------------------------------------------------------
-- 2. whatsapp_messages — one row per recipient (delivery log / audit trail)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "whatsapp_messages" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"       UUID REFERENCES "clinics"("id") ON DELETE CASCADE,
    "group_id"        UUID NOT NULL,             -- shared across all rows of one send
    "sender_id"       UUID NOT NULL,             -- profiles.id
    "sender_role"     TEXT NOT NULL,
    "recipient_kind"  TEXT NOT NULL CHECK ("recipient_kind" IN ('patient','profile')),
    "recipient_id"    UUID,                      -- patients.id or profiles.id (nullable for ad-hoc)
    "recipient_role"  TEXT,                      -- 'patient','doctor','staff','pharmacist','app_owner'
    "to_phone"        TEXT NOT NULL,             -- normalized destination number
    "body"            TEXT NOT NULL,             -- rendered message actually sent
    "template_key"    TEXT,                      -- source template, if any
    "status"          TEXT NOT NULL CHECK ("status" IN ('sent','failed')),
    "waha_message_id" TEXT,                      -- provider message id on success
    "error"           TEXT,                      -- human-readable failure reason
    "created_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by"      UUID
);

CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_tenant"
    ON "whatsapp_messages" ("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_group"
    ON "whatsapp_messages" ("group_id");
CREATE INDEX IF NOT EXISTS "idx_whatsapp_messages_sender"
    ON "whatsapp_messages" ("sender_id", "created_at");

-- ---------------------------------------------------------------------------
-- 3. Row Level Security (defense-in-depth; the app's DATABASE_URL role bypasses
--    RLS, so tenant-scoped server actions remain the primary enforcement).
-- ---------------------------------------------------------------------------
ALTER TABLE "whatsapp_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "whatsapp_messages" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS whatsapp_templates_tenant ON "whatsapp_templates";
CREATE POLICY whatsapp_templates_tenant ON "whatsapp_templates"
    FOR ALL TO authenticated
    USING ("tenant_id" = (SELECT "tenant_id" FROM "profiles" WHERE "auth_user_id" = auth.uid()))
    WITH CHECK ("tenant_id" = (SELECT "tenant_id" FROM "profiles" WHERE "auth_user_id" = auth.uid()));

DROP POLICY IF EXISTS whatsapp_messages_tenant ON "whatsapp_messages";
CREATE POLICY whatsapp_messages_tenant ON "whatsapp_messages"
    FOR ALL TO authenticated
    USING ("tenant_id" = (SELECT "tenant_id" FROM "profiles" WHERE "auth_user_id" = auth.uid()))
    WITH CHECK ("tenant_id" = (SELECT "tenant_id" FROM "profiles" WHERE "auth_user_id" = auth.uid()));

GRANT SELECT, INSERT, UPDATE, DELETE ON "whatsapp_templates" TO authenticated;
GRANT SELECT, INSERT ON "whatsapp_messages" TO authenticated;
