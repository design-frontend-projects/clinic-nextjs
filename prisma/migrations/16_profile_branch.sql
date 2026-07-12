-- 16_profile_branch.sql
-- Assign clinic personnel (doctor/staff/pharmacist/receptionist) to a home branch.
-- Apply manually in the Supabase SQL editor (this project does not use `prisma migrate`).

-- 1) profiles.branch_id -> branches.id (nullable; branch deletion unassigns rather than blocks at the DB level)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_branch_id ON public.profiles(branch_id);

-- 2) Backfill: existing branch-locked personnel get their clinic's oldest branch
--    so nobody logs in with "no branch assigned" after this migration.
UPDATE public.profiles p
SET branch_id = (
  SELECT b.id
  FROM public.branches b
  WHERE b.clinic_id = p.tenant_id
  ORDER BY b.created_at ASC
  LIMIT 1
)
WHERE p.branch_id IS NULL
  AND p.tenant_id IS NOT NULL
  AND p.role IN ('doctor', 'staff', 'pharmacist', 'receptionist')
  AND EXISTS (
    SELECT 1 FROM public.branches b WHERE b.clinic_id = p.tenant_id
  );

-- 3) Defense-in-depth: guarantee an assigned branch belongs to the profile's
--    own clinic (tenant_id). A CHECK constraint can't do cross-table lookups,
--    so enforce it with a trigger (consistent with this project's RLS/trigger
--    approach as the layer beneath app-level tenant scoping).
CREATE OR REPLACE FUNCTION public.enforce_profile_branch_clinic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.branches b
      WHERE b.id = NEW.branch_id
        AND b.clinic_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'branch_id % does not belong to tenant %',
        NEW.branch_id, NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_branch_clinic ON public.profiles;
CREATE TRIGGER trg_profiles_branch_clinic
  BEFORE INSERT OR UPDATE OF branch_id, tenant_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_branch_clinic();
