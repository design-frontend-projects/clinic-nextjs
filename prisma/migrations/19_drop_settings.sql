-- 19_drop_settings.sql
-- Remove the Enterprise Global Settings module: its 12 tables, the document-number
-- claim function, and the settings-feature RBAC permissions. The settings feature
-- (tenant/user/platform config, lookups, feature flags, document numbering, and
-- notification templates/channels) has been removed from the application.
-- Apply manually in the Supabase SQL editor (this project does not use `prisma migrate`).
--
-- This reverses migrations 08_settings_core, 09_lookups, 10_feature_flags,
-- 11_document_sequences, and 12_notifications.
--
-- KEEP: the RBAC permissions `settings.roles.manage` and `settings.audit.read`
-- (seeded in 03_seed_rbac.sql) are NOT part of this feature and are left intact.
-- The in-app `notifications` inbox (13_in_app_notifications.sql) is also unrelated
-- and left intact.

-- ---------------------------------------------------------------------------
-- 1. Settings-feature RBAC permissions and their grants
-- ---------------------------------------------------------------------------
-- Matched by exact name (NOT `LIKE 'settings.%'`) so the RBAC strings
-- settings.roles.manage / settings.audit.read are preserved. The three
-- assignment tables cascade on permission delete, but we clear them explicitly.
DO $$
DECLARE
  v_perm_names TEXT[] := ARRAY[
    'settings.core.read',
    'settings.core.manage',
    'settings.lookups.manage',
    'settings.notifications.manage',
    'settings.sequences.manage',
    'settings.history.read',
    'settings.history.rollback',
    'settings.features.read'
  ];
BEGIN
  DELETE FROM "role_permissions"   WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" = ANY(v_perm_names));
  DELETE FROM "user_permissions"   WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" = ANY(v_perm_names));
  DELETE FROM "tenant_permissions" WHERE "permission_id" IN (SELECT "id" FROM "permissions" WHERE "name" = ANY(v_perm_names));
  DELETE FROM "permissions"        WHERE "name" = ANY(v_perm_names);
END $$;

-- Remove the now-empty permission group.
DELETE FROM "permission_groups" WHERE "name" = 'Settings & Configuration';

-- ---------------------------------------------------------------------------
-- 2. Document-number claim function (11_document_sequences.sql)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.claim_document_number(UUID, TEXT);

-- ---------------------------------------------------------------------------
-- 3. Settings tables. CASCADE also drops their RLS policies, foreign keys, and
--    indexes. Ordered children-before-parents (CASCADE makes order moot, but the
--    ordering documents the dependency graph).
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS "settings_history"          CASCADE;
DROP TABLE IF EXISTS "tenant_settings"           CASCADE;
DROP TABLE IF EXISTS "user_settings"             CASCADE;
DROP TABLE IF EXISTS "setting_definitions"       CASCADE;
DROP TABLE IF EXISTS "tenant_feature_overrides"  CASCADE;
DROP TABLE IF EXISTS "feature_flags"             CASCADE;
DROP TABLE IF EXISTS "lookup_values"             CASCADE;
DROP TABLE IF EXISTS "lookup_categories"         CASCADE;
DROP TABLE IF EXISTS "document_sequences"        CASCADE;
DROP TABLE IF EXISTS "notification_templates"    CASCADE;
DROP TABLE IF EXISTS "notification_channels"     CASCADE;
DROP TABLE IF EXISTS "global_settings"           CASCADE;
