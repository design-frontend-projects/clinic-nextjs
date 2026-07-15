-- 22_notification_sender_index.sql
-- Sender-side history ("what I sent") groups the notifications fan-out by
-- group_id, filtered by sender_id and ordered by created_at. Add a composite
-- index to back that query — the table previously only had recipient-side
-- indexes (see 13_in_app_notifications.sql).
--
-- Apply manually in the Supabase SQL editor (this repo does not use prisma
-- migrate). Safe to re-run.

CREATE INDEX IF NOT EXISTS "idx_notifications_sender_created"
    ON "notifications" ("sender_id", "created_at" DESC);
