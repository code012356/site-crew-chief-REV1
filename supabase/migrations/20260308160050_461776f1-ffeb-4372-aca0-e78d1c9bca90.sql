
-- Work codes table
CREATE TABLE public.work_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL DEFAULT '其他',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.work_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on work_codes" ON public.work_codes FOR ALL USING (true) WITH CHECK (true);

-- Equipment table
CREATE TABLE public.equipment (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_no text,
  name text NOT NULL,
  model text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'available',
  location text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on equipment" ON public.equipment FOR ALL USING (true) WITH CHECK (true);
