ALTER TABLE public.equipment_requests
  ADD COLUMN IF NOT EXISTS quantity integer,
  ADD COLUMN IF NOT EXISTS required_date date,
  ADD COLUMN IF NOT EXISTS request_area text,
  ADD COLUMN IF NOT EXISTS suggested_model text,
  ADD COLUMN IF NOT EXISTS priority text;

UPDATE public.equipment_requests
SET quantity = 1
WHERE request_type = 'new'
  AND quantity IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_requests_quantity_check') THEN
    ALTER TABLE public.equipment_requests
      ADD CONSTRAINT equipment_requests_quantity_check CHECK (quantity IS NULL OR quantity > 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipment_requests_priority_check') THEN
    ALTER TABLE public.equipment_requests
      ADD CONSTRAINT equipment_requests_priority_check CHECK (priority IS NULL OR priority IN ('normal', 'urgent'));
  END IF;
END $$;
