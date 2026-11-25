-- 29_medicine_module.sql
-- Extends the clinic-scoped `medications` catalog with prescribing defaults,
-- clinical categories, creator/updater audit columns, and stop/resume lifecycle
-- fields (`stopped_at`, `stopped_by`, `stop_reason`).
-- Also ensures DB-level UUID generation on `id` and Row Level Security policies.

ALTER TABLE public."medications"
  ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

ALTER TABLE public."medications"
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "default_dosage" TEXT,
  ADD COLUMN IF NOT EXISTS "default_frequency" TEXT,
  ADD COLUMN IF NOT EXISTS "default_duration" TEXT,
  ADD COLUMN IF NOT EXISTS "default_quantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "default_instructions" TEXT,
  ADD COLUMN IF NOT EXISTS "stopped_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "stopped_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "stop_reason" TEXT,
  ADD COLUMN IF NOT EXISTS "created_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "medications_clinic_active_idx"
  ON public."medications" ("clinic_id", "is_active");

CREATE INDEX IF NOT EXISTS "medications_clinic_category_idx"
  ON public."medications" ("clinic_id", "category");

ALTER TABLE public."medications" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS medications_clinic_all ON public."medications";
CREATE POLICY medications_clinic_all ON public."medications"
  FOR ALL TO authenticated
  USING (
    "clinic_id" IN (SELECT id FROM public."clinics" WHERE "auth_user_id" = auth.uid())
    OR "clinic_id" IN (
      SELECT pr."tenant_id"
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."tenant_id" IS NOT NULL
    )
    OR "clinic_id" IN (
      SELECT pb."clinic_id"
      FROM public."profile_branches" pb
      JOIN public."profiles" pr ON pr."id" = pb."profile_id"
      WHERE pr."auth_user_id" = auth.uid()
    )
  )
  WITH CHECK (
    "clinic_id" IN (SELECT id FROM public."clinics" WHERE "auth_user_id" = auth.uid())
    OR "clinic_id" IN (
      SELECT pr."tenant_id"
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."tenant_id" IS NOT NULL
    )
    OR "clinic_id" IN (
      SELECT pb."clinic_id"
      FROM public."profile_branches" pb
      JOIN public."profiles" pr ON pr."id" = pb."profile_id"
      WHERE pr."auth_user_id" = auth.uid()
    )
  );

DROP POLICY IF EXISTS medications_super_admin ON public."medications";
CREATE POLICY medications_super_admin ON public."medications"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."role" IN ('super_admin', 'app_owner')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."profiles" pr
      WHERE pr."auth_user_id" = auth.uid()
        AND pr."role" IN ('super_admin', 'app_owner')
    )
  );
