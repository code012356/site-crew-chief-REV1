
-- Accounts table
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'foreman',
  display_name text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  labor_id text,
  linked_personnel_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Account requests table
CREATE TABLE public.account_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL,
  display_name text NOT NULL,
  role text NOT NULL,
  labor_id text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Disable RLS for now (public app, no supabase auth)
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_requests ENABLE ROW LEVEL SECURITY;

-- Allow all operations (this is a custom auth system, not using supabase auth)
CREATE POLICY "Allow all on accounts" ON public.accounts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on account_requests" ON public.account_requests FOR ALL USING (true) WITH CHECK (true);

-- Seed default accounts
INSERT INTO public.accounts (id, username, password, role, display_name, enabled, labor_id, linked_personnel_id)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'admin', 'admin123', 'admin', '系统管理员', true, null, null),
  ('00000000-0000-0000-0000-000000000002', 'liugz', 'liugz123', 'foreman', '刘工长', true, 'FM-2023-001', 'f1'),
  ('00000000-0000-0000-0000-000000000003', 'lingcs', 'lingcs123', 'engineer', '林工程师', true, null, 'e1');
