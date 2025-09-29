-- 010_test_exec_sql_rpc.sql
-- Purpose: RPC used only by RLS test harness to seed/check data
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'exec_sql' AND n.nspname = 'public'
  ) THEN
    CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $f$
    BEGIN
      EXECUTE sql;
    END
    $f$;

    -- lock it down: only service_role may execute
    REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
    GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;
  END IF;
END
$$;