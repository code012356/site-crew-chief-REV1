ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS leave_date text,
  ADD COLUMN IF NOT EXISTS leave_count integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'personnel_leave_count_nonnegative'
  ) THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_leave_count_nonnegative CHECK (leave_count >= 0);
  END IF;
END $$;
