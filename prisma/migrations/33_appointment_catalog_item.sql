-- 33_appointment_catalog_item.sql
-- Optionally links an appointment to a predefined clinic billing_catalog_items
-- entry so staff can tag the expected service at booking time and doctors can
-- view and invoice it directly.

ALTER TABLE public."appointments"
    ADD COLUMN IF NOT EXISTS "catalog_item_id" UUID
    REFERENCES public."billing_catalog_items"("id")
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "appointments_catalog_item_id_idx"
    ON public."appointments" ("catalog_item_id");
