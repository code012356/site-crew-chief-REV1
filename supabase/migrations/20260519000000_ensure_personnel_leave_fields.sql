ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS leave_date text,
  ADD COLUMN IF NOT EXISTS leave_count integer;

UPDATE public.personnel
SET leave_count = 0
WHERE leave_count IS NULL;

ALTER TABLE public.personnel
  ALTER COLUMN leave_count SET DEFAULT 0,
  ALTER COLUMN leave_count SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personnel_leave_count_nonnegative'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_leave_count_nonnegative CHECK (leave_count >= 0);
  END IF;
END $$;
