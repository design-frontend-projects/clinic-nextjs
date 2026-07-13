-- 17_doctor_multi_branch.sql
-- Multi-clinic / multi-branch assignments for personnel (currently doctors).
--
-- A doctor can be assigned to work across several (clinic, branch) pairs that
-- belong to the same owner. The distinct clinics form the doctor's clinic set;
-- `is_primary` marks the home/default branch selected on first login. The doctor
-- switches their active clinic/branch from the top bar (cookie-driven, validated
-- against these rows), rather than being locked to a single profiles.branch_id.
--
-- profiles.tenant_id / profiles.branch_id remain the doctor's HOME clinic +
-- branch (the primary row), so all existing single-clinic code paths keep
-- working. This table is additive.
--
-- Apply manually in the Supabase SQL editor BEFORE deploying the app code that
-- uses the profile_branches Prisma model. Requires migration 16 (profiles.branch_id).

CREATE TABLE IF NOT EXISTS "profile_branches" (
    "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "profile_id" UUID NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
    "clinic_id"  UUID NOT NULL REFERENCES "clinics"("id")  ON DELETE CASCADE,
    "branch_id"  UUID NOT NULL REFERENCES "branches"("id") ON DELETE CASCADE,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profile_branches_profile_branch_key" UNIQUE ("profile_id", "branch_id")
);

CREATE INDEX IF NOT EXISTS "profile_branches_profile_id_idx" ON "profile_branches" ("profile_id");
CREATE INDEX IF NOT EXISTS "profile_branches_clinic_id_idx"  ON "profile_branches" ("clinic_id");
CREATE INDEX IF NOT EXISTS "profile_branches_branch_id_idx"  ON "profile_branches" ("branch_id");

-- Defense-in-depth: guarantee the assigned branch actually belongs to the row's
-- clinic (a CHECK can't do cross-table lookups, so use a trigger — consistent
-- with 16_profile_branch.sql).
CREATE OR REPLACE FUNCTION public.enforce_profile_branch_row_clinic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.branches b
    WHERE b.id = NEW.branch_id
      AND b.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'branch_id % does not belong to clinic %',
      NEW.branch_id, NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_branches_clinic ON public.profile_branches;
CREATE TRIGGER trg_profile_branches_clinic
  BEFORE INSERT OR UPDATE OF branch_id, clinic_id ON public.profile_branches
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_branch_row_clinic();

-- Backfill: give every existing doctor a primary assignment matching their
-- current home clinic (tenant_id) + branch (profiles.branch_id from migration 16),
-- so they keep exactly one clinic/branch until an admin assigns more.
INSERT INTO public.profile_branches (profile_id, clinic_id, branch_id, is_primary)
SELECT p.id, p.tenant_id, p.branch_id, true
FROM public.profiles p
WHERE p.role = 'doctor'
  AND p.tenant_id IS NOT NULL
  AND p.branch_id IS NOT NULL
ON CONFLICT ("profile_id", "branch_id") DO NOTHING;

-- Row Level Security (defense-in-depth; the app reads/writes via Prisma with a
-- direct connection that bypasses RLS, gated at the action layer).
ALTER TABLE "profile_branches" ENABLE ROW LEVEL SECURITY;

-- Clinic staff manage assignment rows within their own tenant.
DROP POLICY IF EXISTS profile_branches_clinic_all ON "profile_branches";
CREATE POLICY profile_branches_clinic_all ON "profile_branches"
    FOR ALL TO authenticated
    USING ("clinic_id" = auth.current_tenant_id())
    WITH CHECK ("clinic_id" = auth.current_tenant_id());

-- A doctor may read their own assignment rows across all their clinics (needed
-- to populate the clinic/branch switcher even while active in another clinic).
DROP POLICY IF EXISTS profile_branches_owner_select ON "profile_branches";
CREATE POLICY profile_branches_owner_select ON "profile_branches"
    FOR SELECT TO authenticated
    USING (
        "profile_id" IN (
            SELECT pr.id FROM profiles pr WHERE pr.auth_user_id = auth.uid()
        )
    );

-- Super admins may do anything.
DROP POLICY IF EXISTS profile_branches_super_admin ON "profile_branches";
CREATE POLICY profile_branches_super_admin ON "profile_branches"
    FOR ALL TO authenticated
    USING (auth.is_super_admin());
