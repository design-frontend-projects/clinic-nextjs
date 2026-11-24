-- 26_lab_confirmation_and_invoice_history.sql
-- Adds:
--   1. 'confirmed' value to LabOrderStatus enum
--   2. Doctor confirmation metadata & notes on lab_orders (doctor_notes, confirmed_at, confirmed_by)
--   3. Creator tracking on invoices (created_by)
--   4. Append-only invoice_history table with RLS policies & immutability trigger

ALTER TYPE "LabOrderStatus" ADD VALUE IF NOT EXISTS 'confirmed';

ALTER TABLE public."lab_orders"
  ADD COLUMN IF NOT EXISTS "doctor_notes" TEXT,
  ADD COLUMN IF NOT EXISTS "confirmed_at" TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "confirmed_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "lab_orders_confirmed_by_idx"
  ON public."lab_orders" ("confirmed_by");

ALTER TABLE public."invoices"
  ADD COLUMN IF NOT EXISTS "created_by" UUID REFERENCES public."profiles"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "invoices_created_by_idx"
  ON public."invoices" ("created_by");

CREATE TABLE IF NOT EXISTS public."invoice_history" (
  "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clinic_id"       UUID NOT NULL REFERENCES public."clinics"("id") ON DELETE CASCADE,
  "invoice_id"      UUID NOT NULL REFERENCES public."invoices"("id") ON DELETE CASCADE,
  "action"          TEXT NOT NULL,
  "changed_by"      UUID REFERENCES public."profiles"("id") ON DELETE SET NULL,
  "changed_by_name" TEXT,
  "changed_by_role" TEXT,
  "reason"          TEXT,
  "previous_data"   JSONB,
  "new_data"        JSONB,
  "created_at"      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "invoice_history_invoice_created_idx"
  ON public."invoice_history" ("invoice_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "invoice_history_clinic_id_idx"
  ON public."invoice_history" ("clinic_id");

ALTER TABLE public."invoice_history" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS invoice_history_clinic_select ON public."invoice_history";
CREATE POLICY invoice_history_clinic_select ON public."invoice_history"
  FOR SELECT TO authenticated
  USING ("clinic_id" = (SELECT "tenant_id" FROM public."profiles" WHERE "auth_user_id" = auth.uid()));

DROP POLICY IF EXISTS invoice_history_clinic_insert ON public."invoice_history";
CREATE POLICY invoice_history_clinic_insert ON public."invoice_history"
  FOR INSERT TO authenticated
  WITH CHECK ("clinic_id" = (SELECT "tenant_id" FROM public."profiles" WHERE "auth_user_id" = auth.uid()));

DROP POLICY IF EXISTS invoice_history_super_admin_select ON public."invoice_history";
CREATE POLICY invoice_history_super_admin_select ON public."invoice_history"
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public."profiles" WHERE "auth_user_id" = auth.uid() AND "role" = 'super_admin'));

DROP POLICY IF EXISTS invoice_history_super_admin_insert ON public."invoice_history";
CREATE POLICY invoice_history_super_admin_insert ON public."invoice_history"
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public."profiles" WHERE "auth_user_id" = auth.uid() AND "role" = 'super_admin'));

CREATE OR REPLACE FUNCTION public.prevent_invoice_history_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Invoice history records are immutable and cannot be updated or deleted.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_invoice_history_mutation ON public."invoice_history";
CREATE TRIGGER trg_prevent_invoice_history_mutation
  BEFORE UPDATE OR DELETE ON public."invoice_history"
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_invoice_history_mutation();
