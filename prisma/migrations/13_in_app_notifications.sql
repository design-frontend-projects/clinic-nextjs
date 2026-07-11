-- 13_in_app_notifications.sql
-- In-app notification inbox (distinct from the outbound email/SMS/WhatsApp
-- template module in 12_notifications.sql). One row PER RECIPIENT, with the
-- display fields (title/body/priority/...) denormalized onto the row so that
-- the Supabase Realtime `postgres_changes` payload is self-sufficient — the
-- recipient's browser can render the toast/badge with no follow-up fetch.
--
-- A single "send" fans out to N rows sharing one `group_id` (the batch id).
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

-- ---------------------------------------------------------------------------
-- 1. notifications — one row per recipient
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "notifications" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"      UUID REFERENCES "clinics"("id") ON DELETE CASCADE, -- recipient's tenant; NULL for platform recipients
    "group_id"       UUID NOT NULL,                     -- shared across all rows of one send (batch / "what I sent")
    "sender_id"      UUID NOT NULL,                     -- profiles.id
    "sender_role"    TEXT NOT NULL,
    "sender_name"    TEXT,                              -- denormalized for display (no join on render)
    "recipient_id"   UUID NOT NULL,                     -- profiles.id
    "recipient_role" TEXT NOT NULL,
    "title"          TEXT NOT NULL,
    "body"           TEXT NOT NULL,
    "category"       TEXT CHECK ("category" IN ('announcement','billing','account_status','policy','shift_change','handoff','general')),
    "priority"       TEXT NOT NULL DEFAULT 'normal' CHECK ("priority" IN ('normal','important')),
    "deep_link"      TEXT,
    "status"         TEXT NOT NULL DEFAULT 'unread' CHECK ("status" IN ('unread','read')),
    "delivered_at"   TIMESTAMP,
    "read_at"        TIMESTAMP,
    "is_active"      BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at"     TIMESTAMP,
    "created_by"     UUID,
    "updated_by"     UUID,
    CONSTRAINT "notifications_group_recipient_key" UNIQUE ("group_id", "recipient_id")  -- dedup on retry
);

CREATE INDEX IF NOT EXISTS "idx_notifications_recipient_status"
    ON "notifications" ("recipient_id", "status");
CREATE INDEX IF NOT EXISTS "idx_notifications_tenant"
    ON "notifications" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_group"
    ON "notifications" ("group_id");

-- ---------------------------------------------------------------------------
-- 2. Row Level Security (defense-in-depth; the app's DATABASE_URL role bypasses
--    RLS, so server actions remain the primary enforcement. RLS is also the
--    security boundary for Realtime: the recipient's *authenticated* browser
--    only receives change events for rows this policy admits.)
-- ---------------------------------------------------------------------------
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;

-- A recipient can read/update only their own rows. Sub-select resolves the
-- caller's profile id from the Supabase auth uid.
DROP POLICY IF EXISTS notifications_recipient ON "notifications";
CREATE POLICY notifications_recipient ON "notifications"
    FOR ALL TO authenticated
    USING ("recipient_id" = (SELECT "id" FROM "profiles" WHERE "auth_user_id" = auth.uid()))
    WITH CHECK ("recipient_id" = (SELECT "id" FROM "profiles" WHERE "auth_user_id" = auth.uid()));

DROP POLICY IF EXISTS notifications_super_admin ON "notifications";
CREATE POLICY notifications_super_admin ON "notifications"
    FOR ALL TO authenticated USING (auth.is_super_admin());

GRANT SELECT, UPDATE ON "notifications" TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Realtime — publish the table and emit full rows on UPDATE so cross-device
--    read-state sync (status -> 'read') carries the row to every open tab.
-- ---------------------------------------------------------------------------
ALTER TABLE "notifications" REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notifications'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "notifications";
      RAISE NOTICE 'Added "notifications" to publication supabase_realtime.';
    END IF;
  ELSE
    RAISE NOTICE 'Publication supabase_realtime not found — enable Realtime in Supabase, then re-run this block.';
  END IF;
END $$;
