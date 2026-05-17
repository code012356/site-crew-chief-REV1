
CREATE TABLE public.equipment_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL DEFAULT 'foreman',
  equipment_id TEXT,
  equipment_name TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  admin_comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  resolved_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.equipment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on equipment_requests" ON public.equipment_requests
  FOR ALL USING (true) WITH CHECK (true);
