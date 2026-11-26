-- 31_sync_indexes.sql
-- Composite indexes backing the RxDB checkpoint pull query:
--   WHERE clinic_id = $1 AND (updated_at > $2 OR (updated_at = $2 AND id > $3))
--   ORDER BY updated_at ASC, id ASC

CREATE INDEX IF NOT EXISTS patients_clinic_updated_id_idx
  ON public."patients" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS appointments_clinic_updated_id_idx
  ON public."appointments" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS encounters_clinic_updated_id_idx
  ON public."encounters" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS medical_records_clinic_updated_id_idx
  ON public."medical_records" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS lab_orders_clinic_updated_id_idx
  ON public."lab_orders" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS lab_results_clinic_updated_id_idx
  ON public."lab_results" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS invoices_clinic_updated_id_idx
  ON public."invoices" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS invoice_items_clinic_updated_id_idx
  ON public."invoice_items" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS payments_clinic_updated_id_idx
  ON public."payments" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS prescription_dispenses_clinic_updated_id_idx
  ON public."prescription_dispenses" (clinic_id, updated_at, id);

CREATE INDEX IF NOT EXISTS prescription_dispense_items_clinic_updated_id_idx
  ON public."prescription_dispense_items" (clinic_id, updated_at, id);
