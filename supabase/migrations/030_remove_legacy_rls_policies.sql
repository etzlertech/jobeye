-- 030_remove_legacy_rls_policies.sql
-- Drop legacy tenant policies that reference joins and rely on new JWT-based policies

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Users can view their tenant''s customers'
  ) THEN
    DROP POLICY "Users can view their tenant's customers" ON public.customers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'customers'
      AND policyname = 'Users can manage their tenant''s customers'
  ) THEN
    DROP POLICY "Users can manage their tenant's customers" ON public.customers;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'Users can view their tenant''s media assets'
  ) THEN
    DROP POLICY "Users can view their tenant's media assets" ON public.media_assets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'media_assets'
      AND policyname = 'Users can upload media for their tenant'
  ) THEN
    DROP POLICY "Users can upload media for their tenant" ON public.media_assets;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_sessions'
      AND policyname = 'voice_allow_all_for_now'
  ) THEN
    DROP POLICY voice_allow_all_for_now ON public.voice_sessions;
  END IF;
END $$;
