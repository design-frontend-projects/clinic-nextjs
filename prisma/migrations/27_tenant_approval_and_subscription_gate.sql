-- 27_tenant_approval_and_subscription_gate.sql
-- Adds:
--   1. 'under_review' and 'rejected' values to ClinicStatus enum
--   2. 'pending_approval' value to SubscriptionStatus enum
--   3. Request reference sequence (tenant_request_ref_seq)
--   4. Review & activation metadata columns on clinics
--   5. Grace period and activation timestamp on tenant_subscriptions
--   6. Backfill for existing active/trial clinics so active tenants are not locked out

ALTER TYPE "ClinicStatus" ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE "ClinicStatus" ADD VALUE IF NOT EXISTS 'rejected';

ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'pending_approval';

CREATE SEQUENCE IF NOT EXISTS public.tenant_request_ref_seq START 1;

ALTER TABLE public."clinics"
  ADD COLUMN IF NOT EXISTS "request_ref" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "reviewed_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT;

CREATE INDEX IF NOT EXISTS "clinics_status_idx"
  ON public."clinics" ("status");

ALTER TABLE public."tenant_subscriptions"
  ADD COLUMN IF NOT EXISTS "grace_period_days" INTEGER NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS "activated_at" TIMESTAMP;

UPDATE public."clinics"
SET "activated_at" = COALESCE("onboarding_completed_at", "created_at")
WHERE "status" IN ('active', 'trial')
  AND "activated_at" IS NULL;

UPDATE public."tenant_subscriptions" ts
SET
  "payment_status" = 'paid',
  "activated_at" = COALESCE(ts."activated_at", ts."start_date", ts."created_at")
FROM public."clinics" c
WHERE ts."tenant_id" = c."id"
  AND c."status" = 'active'
  AND ts."payment_status" = 'pending';
