-- 031_remove_voice_sessions_allow_all.sql
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'voice_sessions'
      AND policyname = 'voice_sessions_allow_all_for_now'
  ) THEN
    DROP POLICY "voice_sessions_allow_all_for_now" ON public.voice_sessions;
  END IF;
END $$;
