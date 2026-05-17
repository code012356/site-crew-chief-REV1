
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS code_no text,
  ADD COLUMN IF NOT EXISTS passport_no text,
  ADD COLUMN IF NOT EXISTS visa_expiry_date text,
  ADD COLUMN IF NOT EXISTS nationality text,
  ADD COLUMN IF NOT EXISTS entry_affiliation text,
  ADD COLUMN IF NOT EXISTS exit_date text,
  ADD COLUMN IF NOT EXISTS exit_affiliation text,
  ADD COLUMN IF NOT EXISTS leave_records_2025 text,
  ADD COLUMN IF NOT EXISTS leave_records_2026 text;
