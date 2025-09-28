-- 020_create_voice_sessions_stub.sql
-- Minimal voice_sessions stub required by RLS seeds
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'voice_sessions'
  ) THEN
    CREATE TABLE public.voice_sessions (
      id text PRIMARY KEY,
      company_id text,
      user_id text,
      session_type text,
      start_time timestamptz,
      end_time timestamptz,
      is_active boolean DEFAULT true,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
    ) THEN
      CREATE FUNCTION public.set_updated_at()
      RETURNS trigger AS $f$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $f$ LANGUAGE plpgsql;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'voice_sessions_set_updated_at'
    ) THEN
      CREATE TRIGGER voice_sessions_set_updated_at
      BEFORE UPDATE ON public.voice_sessions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'voice_sessions'
        AND policyname = 'voice_sessions_allow_all_for_now'
    ) THEN
      CREATE POLICY voice_sessions_allow_all_for_now
        ON public.voice_sessions
        FOR ALL
        TO PUBLIC
        USING (true)
        WITH CHECK (true);
    END IF;
  END IF;
END $$;