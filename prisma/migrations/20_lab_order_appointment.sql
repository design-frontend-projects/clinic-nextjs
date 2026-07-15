-- 20_lab_order_appointment.sql
-- Link a lab order directly to the appointment it was requested from, so doctors can
-- raise lab requests against an appointment (gated to appointments that are not completed).
-- Apply manually in the Supabase SQL editor (this project does not use `prisma migrate`).

-- 1) Nullable FK column on lab_orders -> appointments.
ALTER TABLE public.lab_orders
  ADD COLUMN IF NOT EXISTS appointment_id uuid;

-- 2) Foreign key: clearing the appointment leaves the lab order intact (SET NULL).
ALTER TABLE public.lab_orders
  DROP CONSTRAINT IF EXISTS lab_orders_appointment_id_fkey;
ALTER TABLE public.lab_orders
  ADD CONSTRAINT lab_orders_appointment_id_fkey
  FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

-- 3) Index for lookups by appointment.
CREATE INDEX IF NOT EXISTS lab_orders_appointment_id_idx
  ON public.lab_orders (appointment_id);
