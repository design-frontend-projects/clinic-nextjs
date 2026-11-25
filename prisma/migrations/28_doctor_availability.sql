-- 28_doctor_availability.sql
-- Adds per-doctor working hours, working days, and examination slot duration (15 or 30 min)

ALTER TABLE public."profiles"
  ADD COLUMN IF NOT EXISTS "available_from" TEXT DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS "available_to" TEXT DEFAULT '17:00',
  ADD COLUMN IF NOT EXISTS "slot_duration_minutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS "available_days" INTEGER[] NOT NULL DEFAULT ARRAY[0, 1, 2, 3, 4];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_slot_duration_minutes_check'
  ) THEN
    ALTER TABLE public."profiles"
      ADD CONSTRAINT "profiles_slot_duration_minutes_check"
      CHECK ("slot_duration_minutes" IN (15, 30));
  END IF;
END $$;
