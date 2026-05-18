CREATE TABLE IF NOT EXISTS public.work_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'work_areas'
      AND policyname = 'Allow all work_areas operations'
  ) THEN
    CREATE POLICY "Allow all work_areas operations"
      ON public.work_areas
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO public.work_areas (name)
VALUES ('Area A'), ('Area B'), ('Area C'), ('Area D'), ('Area E'), ('Area F')
ON CONFLICT (name) DO NOTHING;
