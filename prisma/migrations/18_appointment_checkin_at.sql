-- 18_appointment_checkin_at.sql
-- Track when a patient physically checks in so the staff queue can show live wait-times.
-- Apply manually in the Supabase SQL editor (this project does not use `prisma migrate`).

-- 1) appointments.checked_in_at -> set when status flips to `checked_in`; null otherwise.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;

-- 2) Backfill: existing rows already in `checked_in` get a best-effort timestamp from updated_at
--    so historical queue items still render a wait-time instead of blank.
UPDATE public.appointments
SET checked_in_at = updated_at
WHERE status = 'checked_in'
  AND checked_in_at IS NULL;
