-- Migration: 009_company_settings.sql
-- Purpose: Create company settings table with defaults, RLS, and seeding
-- Dependencies: companies table

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'company_settings'
  ) THEN
    CREATE TABLE public.company_settings (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id uuid NOT NULL,
      vision_thresholds jsonb DEFAULT '{
        "confidenceThreshold": 0.7,
        "maxObjects": 20,
        "checkExpectedItems": true
      }'::jsonb,
      voice_preferences jsonb DEFAULT '{
        "wakeWord": "Hey JobEye",
        "voiceName": "Google US English",
        "speechRate": 1.0,
        "confirmationRequired": true
      }'::jsonb,
      budget_limits jsonb DEFAULT '{
        "stt": 10.00,
        "tts": 5.00,
        "vlm": 25.00,
        "llm": 50.00
      }'::jsonb,
      features jsonb DEFAULT '{
        "offlineMode": true,
        "visionVerification": true,
        "voiceCommands": true
      }'::jsonb,
      created_at timestamptz DEFAULT NOW(),
      updated_at timestamptz DEFAULT NOW()
    );
  END IF;
END $$;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT uuid_generate_v4();

ALTER TABLE public.company_settings
  ALTER COLUMN id SET DEFAULT uuid_generate_v4();

ALTER TABLE public.company_settings
  ALTER COLUMN id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.company_settings'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT company_settings_pkey PRIMARY KEY (id);
  END IF;
END $$;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS company_id uuid;

ALTER TABLE public.company_settings
  ALTER COLUMN company_id SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = 'public.company_settings'::regclass
        AND conname = 'company_settings_company_id_fkey'
    ) THEN
      ALTER TABLE public.company_settings
        ADD CONSTRAINT company_settings_company_id_fkey
        FOREIGN KEY (company_id)
        REFERENCES public.companies(id)
        ON DELETE CASCADE;
    END IF;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.company_settings'::regclass
      AND conname = 'company_settings_company_id_key'
  ) THEN
    ALTER TABLE public.company_settings
      ADD CONSTRAINT company_settings_company_id_key UNIQUE (company_id);
  END IF;
END $$;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS vision_thresholds jsonb;

ALTER TABLE public.company_settings
  ALTER COLUMN vision_thresholds SET DEFAULT '{
    "confidenceThreshold": 0.7,
    "maxObjects": 20,
    "checkExpectedItems": true
  }'::jsonb;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS voice_preferences jsonb;

ALTER TABLE public.company_settings
  ALTER COLUMN voice_preferences SET DEFAULT '{
    "wakeWord": "Hey JobEye",
    "voiceName": "Google US English",
    "speechRate": 1.0,
    "confirmationRequired": true
  }'::jsonb;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS budget_limits jsonb;

ALTER TABLE public.company_settings
  ALTER COLUMN budget_limits SET DEFAULT '{
    "stt": 10.00,
    "tts": 5.00,
    "vlm": 25.00,
    "llm": 50.00
  }'::jsonb;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS features jsonb;

ALTER TABLE public.company_settings
  ALTER COLUMN features SET DEFAULT '{
    "offlineMode": true,
    "visionVerification": true,
    "voiceCommands": true
  }'::jsonb;

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS created_at timestamptz;

ALTER TABLE public.company_settings
  ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

ALTER TABLE public.company_settings
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.company_settings
  ALTER COLUMN updated_at SET NOT NULL;

-- Ensure updated_at trigger helper exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at'
      AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  END IF;
END $$;

-- Ensure updated_at maintains current timestamps
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_company_settings'
      AND tgrelid = 'public.company_settings'::regclass
  ) THEN
    CREATE TRIGGER set_updated_at_company_settings
    BEFORE UPDATE ON public.company_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- Enable and enforce RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_settings FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'company_settings'
      AND policyname = 'company_settings_tenant_isolation'
  ) THEN
    CREATE POLICY company_settings_tenant_isolation
      ON public.company_settings
      FOR ALL
      TO authenticated
      USING (company_id = (auth.jwt() ->> 'company_id')::uuid)
      WITH CHECK (company_id = (auth.jwt() ->> 'company_id')::uuid);
  END IF;
END $$;

-- Auto-create settings when a company is inserted
CREATE OR REPLACE FUNCTION public.create_default_company_settings()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.company_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'create_company_settings'
        AND tgrelid = 'public.companies'::regclass
    ) THEN
      CREATE TRIGGER create_company_settings
        AFTER INSERT ON public.companies
        FOR EACH ROW
        EXECUTE FUNCTION public.create_default_company_settings();
    END IF;
  END IF;
END $$;

-- Seed default settings for existing companies
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'companies'
  ) THEN
    INSERT INTO public.company_settings (company_id)
    SELECT c.id
    FROM public.companies c
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.company_settings cs
      WHERE cs.company_id = c.id
    );
  END IF;
END $$;
