-- 30_tenant_subscription_owner_auth_id.sql
-- Migrates tenant_subscriptions.tenant_id from clinics.id to the tenant owner's
-- auth_user_id (referencing public.profiles(auth_user_id)), enabling multiple
-- clinics owned by the same user to share one subscription.

-- 1) Drop the old FK referencing clinics(id)
ALTER TABLE public."tenant_subscriptions"
  DROP CONSTRAINT IF EXISTS "tenant_subscriptions_tenant_id_fkey";

-- 2) Defensively deduplicate if multiple clinics for the same owner each had a subscription row
WITH mapped AS (
  SELECT
    ts.id,
    c.auth_user_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.auth_user_id
      ORDER BY ts.updated_at DESC, ts.created_at DESC, ts.id DESC
    ) AS rn
  FROM public."tenant_subscriptions" ts
  JOIN public."clinics" c ON ts."tenant_id" = c."id"
  WHERE c."auth_user_id" IS NOT NULL
)
DELETE FROM public."tenant_subscriptions" ts
USING mapped m
WHERE ts."id" = m."id"
  AND m.rn > 1;

-- 3) Backfill existing rows from clinic.id -> clinics.auth_user_id
UPDATE public."tenant_subscriptions" ts
SET "tenant_id" = c."auth_user_id"
FROM public."clinics" c
WHERE ts."tenant_id" = c."id"
  AND c."auth_user_id" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public."profiles" p WHERE p."auth_user_id" = c."auth_user_id"
  );

-- 4) Point FK to public.profiles(auth_user_id) ON DELETE CASCADE
ALTER TABLE public."tenant_subscriptions"
  ADD CONSTRAINT "tenant_subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id")
  REFERENCES public."profiles"("auth_user_id")
  ON DELETE CASCADE;

-- 5) Index clinics.auth_user_id for fast multi-clinic owner lookups
CREATE INDEX IF NOT EXISTS "clinics_auth_user_id_idx"
  ON public."clinics" ("auth_user_id");

-- 6) Refresh RLS policies on public.tenant_subscriptions
ALTER TABLE public."tenant_subscriptions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Policy with security definer functions" ON public."tenant_subscriptions";
DROP POLICY IF EXISTS "tenant_subscriptions_owner_all" ON public."tenant_subscriptions";
DROP POLICY IF EXISTS "tenant_subscriptions_clinic_member_select" ON public."tenant_subscriptions";
DROP POLICY IF EXISTS "tenant_subscriptions_app_owner_all" ON public."tenant_subscriptions";

CREATE POLICY "tenant_subscriptions_owner_all" ON public."tenant_subscriptions"
  FOR ALL TO authenticated
  USING ("tenant_id" = auth.uid())
  WITH CHECK ("tenant_id" = auth.uid());

CREATE POLICY "tenant_subscriptions_clinic_member_select" ON public."tenant_subscriptions"
  FOR SELECT TO authenticated
  USING (
    "tenant_id" IN (
      SELECT c."auth_user_id"
      FROM public."clinics" c
      JOIN public."profiles" p ON p."tenant_id" = c."id"
      WHERE p."auth_user_id" = auth.uid()
        AND c."auth_user_id" IS NOT NULL
    )
    OR "tenant_id" IN (
      SELECT c."auth_user_id"
      FROM public."clinics" c
      JOIN public."profile_branches" pb ON pb."clinic_id" = c."id"
      JOIN public."profiles" p ON p."id" = pb."profile_id"
      WHERE p."auth_user_id" = auth.uid()
        AND c."auth_user_id" IS NOT NULL
    )
  );

CREATE POLICY "tenant_subscriptions_app_owner_all" ON public."tenant_subscriptions"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."role" IN ('app_owner', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."role" IN ('app_owner', 'super_admin')
    )
  );
