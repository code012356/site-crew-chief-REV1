
ALTER TABLE public.personnel
  ADD COLUMN IF NOT EXISTS project_dept text,
  ADD COLUMN IF NOT EXISTS assigned_to text,
  ADD COLUMN IF NOT EXISTS work_line text,
  ADD COLUMN IF NOT EXISTS actual_work text,
  ADD COLUMN IF NOT EXISTS seq_no integer;
