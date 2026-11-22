-- 24_shared_clinic_branches.sql
-- Owner-level shared branches (many-to-many between clinics and branches).
--
-- Owners define their physical branches once (scoped by `branches.owner_id`,
-- unique case-insensitively by name per owner) and link one or more branches to
-- any clinic they create via the `clinic_branches` join table.
--
-- `branches.clinic_id` is made nullable for backward compatibility; the source
-- of truth for clinic <-> branch membership is `public.clinic_branches`.

-- 1) Add owner_id to branches, backfill from clinics.auth_user_id, and make clinic_id nullable.
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS owner_id UUID;

UPDATE public.branches b
SET owner_id = c.auth_user_id
FROM public.clinics c
WHERE b.clinic_id = c.id
  AND b.owner_id IS NULL
  AND c.auth_user_id IS NOT NULL;

ALTER TABLE public.branches
  ALTER COLUMN clinic_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS branches_owner_id_idx
  ON public.branches (owner_id);

-- Prevent duplicate branch names per owner (case-insensitive, trimmed).
CREATE UNIQUE INDEX IF NOT EXISTS branches_owner_lower_name_key
  ON public.branches (owner_id, lower(btrim(name)))
  WHERE owner_id IS NOT NULL;

-- 2) Create clinic_branches join table.
CREATE TABLE IF NOT EXISTS public.clinic_branches (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id  UUID NOT NULL REFERENCES public.clinics(id)  ON DELETE CASCADE,
  branch_id  UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT clinic_branches_clinic_branch_key UNIQUE (clinic_id, branch_id)
);

CREATE INDEX IF NOT EXISTS clinic_branches_clinic_id_idx
  ON public.clinic_branches (clinic_id);

CREATE INDEX IF NOT EXISTS clinic_branches_branch_id_idx
  ON public.clinic_branches (branch_id);

-- Enforce at most one primary branch per clinic.
CREATE UNIQUE INDEX IF NOT EXISTS clinic_branches_one_primary_per_clinic_idx
  ON public.clinic_branches (clinic_id)
  WHERE is_primary = true;

-- 3) Backfill clinic_branches from existing branches.clinic_id rows,
--    marking the oldest branch per clinic as primary.
WITH ranked AS (
  SELECT
    b.clinic_id,
    b.id AS branch_id,
    ROW_NUMBER() OVER (PARTITION BY b.clinic_id ORDER BY b.created_at ASC, b.id ASC) AS rn
  FROM public.branches b
  WHERE b.clinic_id IS NOT NULL
)
INSERT INTO public.clinic_branches (clinic_id, branch_id, is_primary)
SELECT clinic_id, branch_id, (rn = 1)
FROM ranked
ON CONFLICT (clinic_id, branch_id) DO NOTHING;

-- 4) Update profile_branches uniqueness to (profile_id, clinic_id, branch_id)
--    so a doctor can be assigned to multiple clinics sharing the same physical branch.
ALTER TABLE public.profile_branches
  DROP CONSTRAINT IF EXISTS profile_branches_profile_branch_key;

DROP INDEX IF EXISTS public.profile_branches_profile_id_branch_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS profile_branches_profile_clinic_branch_key
  ON public.profile_branches (profile_id, clinic_id, branch_id);

-- 5) Update defense-in-depth triggers from migrations 16 & 17 to check clinic_branches.
CREATE OR REPLACE FUNCTION public.enforce_profile_branch_clinic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.branch_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clinic_branches cb
      WHERE cb.branch_id = NEW.branch_id
        AND cb.clinic_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'branch_id % does not belong to tenant %',
        NEW.branch_id, NEW.tenant_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_profile_branch_row_clinic()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.clinic_branches cb
    WHERE cb.branch_id = NEW.branch_id
      AND cb.clinic_id = NEW.clinic_id
  ) THEN
    RAISE EXCEPTION 'branch_id % does not belong to clinic %',
      NEW.branch_id, NEW.clinic_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 6) Row Level Security on clinic_branches (defense-in-depth).
ALTER TABLE public.clinic_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clinic_branches_owner_all ON public.clinic_branches;
CREATE POLICY clinic_branches_owner_all ON public.clinic_branches
  FOR ALL TO authenticated
  USING (
    clinic_id IN (SELECT id FROM public.clinics WHERE auth_user_id = auth.uid())
  )
  WITH CHECK (
    clinic_id IN (SELECT id FROM public.clinics WHERE auth_user_id = auth.uid())
  );

DROP POLICY IF EXISTS clinic_branches_tenant_select ON public.clinic_branches;
CREATE POLICY clinic_branches_tenant_select ON public.clinic_branches
  FOR SELECT TO authenticated
  USING (
    clinic_id IN (
      SELECT pr.tenant_id
      FROM public.profiles pr
      WHERE pr.auth_user_id = auth.uid()
        AND pr.tenant_id IS NOT NULL
    )
    OR clinic_id IN (
      SELECT pb.clinic_id
      FROM public.profile_branches pb
      JOIN public.profiles pr ON pr.id = pb.profile_id
      WHERE pr.auth_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS clinic_branches_super_admin ON public.clinic_branches;
CREATE POLICY clinic_branches_super_admin ON public.clinic_branches
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles pr
      WHERE pr.auth_user_id = auth.uid()
        AND pr.role IN ('super_admin', 'app_owner')
    )
  );
