-- 023_to_uuid_helper.sql
-- Helper to deterministically map a text label -> UUID for seed/test data.
DO $$
BEGIN
  -- Ensure uuid-ossp extension is available
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Create helper if missing
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'to_uuid' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.to_uuid(label text)
    RETURNS uuid
    LANGUAGE sql
    IMMUTABLE
    AS $f$
      SELECT uuid_generate_v5(uuid_ns_url(), label)
    $f$;
  END IF;
END
$$;