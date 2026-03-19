/*
  MVP anon access patch
  - Keeps current frontend (no auth flow) functional with anon key
  - Scope is intentionally minimal: patients INSERT/SELECT, medical_images SELECT, ai_analyses SELECT
  - For production, replace with authenticated policies + explicit auth flow
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patients'
      AND policyname = 'MVP anon can view patients'
  ) THEN
    CREATE POLICY "MVP anon can view patients"
      ON public.patients
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'patients'
      AND policyname = 'MVP anon can insert patients'
  ) THEN
    CREATE POLICY "MVP anon can insert patients"
      ON public.patients
      FOR INSERT
      TO anon
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'medical_images'
      AND policyname = 'MVP anon can view medical_images'
  ) THEN
    CREATE POLICY "MVP anon can view medical_images"
      ON public.medical_images
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_analyses'
      AND policyname = 'MVP anon can view ai_analyses'
  ) THEN
    CREATE POLICY "MVP anon can view ai_analyses"
      ON public.ai_analyses
      FOR SELECT
      TO anon
      USING (true);
  END IF;
END $$;
