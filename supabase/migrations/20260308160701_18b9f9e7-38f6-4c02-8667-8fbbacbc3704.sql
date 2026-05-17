
-- Personnel table
CREATE TABLE public.personnel (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  labor_id text,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'worker',
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  specialty text,
  join_date text NOT NULL DEFAULT to_char(now(), 'YYYY-MM-DD'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.personnel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on personnel" ON public.personnel FOR ALL USING (true) WITH CHECK (true);

-- Daily logs table (entries stored as JSONB)
CREATE TABLE public.daily_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  date text NOT NULL,
  foreman_id text NOT NULL,
  foreman_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_comment text,
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_usage jsonb NOT NULL DEFAULT '[]'::jsonb,
  revisions jsonb,
  deleted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on daily_logs" ON public.daily_logs FOR ALL USING (true) WITH CHECK (true);

-- Team assignments table
CREATE TABLE public.team_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  foreman_id text NOT NULL UNIQUE,
  worker_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  equipment_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.team_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on team_assignments" ON public.team_assignments FOR ALL USING (true) WITH CHECK (true);

-- Engineer assignments table
CREATE TABLE public.engineer_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  engineer_id text NOT NULL UNIQUE,
  foreman_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);
ALTER TABLE public.engineer_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on engineer_assignments" ON public.engineer_assignments FOR ALL USING (true) WITH CHECK (true);
