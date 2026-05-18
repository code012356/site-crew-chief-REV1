DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_role_check') THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_role_check CHECK (role IN ('worker', 'foreman', 'engineer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'personnel_status_check') THEN
    ALTER TABLE public.personnel
      ADD CONSTRAINT personnel_status_check CHECK (status IN ('active', 'leave', 'resigned'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_status_check') THEN
    ALTER TABLE public.equipment
      ADD CONSTRAINT equipment_status_check CHECK (status IN ('available', 'in_use', 'maintenance', 'retired'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'daily_logs_status_check') THEN
    ALTER TABLE public.daily_logs
      ADD CONSTRAINT daily_logs_status_check CHECK (status IN ('pending', 'approved', 'conditional', 'rejected', 'withdraw_requested', 'withdrawn'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_role_check') THEN
    ALTER TABLE public.accounts
      ADD CONSTRAINT accounts_role_check CHECK (role IN ('admin', 'foreman', 'engineer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_requests_role_check') THEN
    ALTER TABLE public.equipment_requests
      ADD CONSTRAINT equipment_requests_role_check CHECK (requester_role IN ('admin', 'foreman', 'engineer'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_requests_type_check') THEN
    ALTER TABLE public.equipment_requests
      ADD CONSTRAINT equipment_requests_type_check CHECK (request_type IN ('existing', 'new'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_requests_status_check') THEN
    ALTER TABLE public.equipment_requests
      ADD CONSTRAINT equipment_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn', 'engineer_pending', 'engineer_approved', 'engineer_rejected'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS accounts_linked_personnel_unique
  ON public.accounts (linked_personnel_id)
  WHERE linked_personnel_id IS NOT NULL AND linked_personnel_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS accounts_phone_unique
  ON public.accounts (phone)
  WHERE phone IS NOT NULL AND phone <> '';

CREATE UNIQUE INDEX IF NOT EXISTS personnel_labor_id_unique
  ON public.personnel (labor_id)
  WHERE labor_id IS NOT NULL AND labor_id <> '';

CREATE UNIQUE INDEX IF NOT EXISTS equipment_no_unique
  ON public.equipment (equipment_no)
  WHERE equipment_no IS NOT NULL AND equipment_no <> '';

CREATE UNIQUE INDEX IF NOT EXISTS work_codes_code_unique
  ON public.work_codes (code);
