ALTER TABLE public.accounts
  DROP CONSTRAINT IF EXISTS accounts_role_check;

ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_role_check
  CHECK (role IN ('admin', 'equipment_admin', 'foreman', 'engineer'));

ALTER TABLE public.equipment_requests
  DROP CONSTRAINT IF EXISTS equipment_requests_role_check;

ALTER TABLE public.equipment_requests
  ADD CONSTRAINT equipment_requests_role_check
  CHECK (requester_role IN ('admin', 'equipment_admin', 'foreman', 'engineer'));
