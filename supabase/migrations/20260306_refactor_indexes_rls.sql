-- Performance indexes + RLS hardening for Companion production prep.

DO $$
BEGIN
  IF to_regclass('public.check_ins') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_checkins_user_created ON public.check_ins(user_id, created_at DESC)';
  END IF;

  IF to_regclass('public.daily_checkins') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date ON public.daily_checkins(user_id, date DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_created ON public.daily_checkins(user_id, created_at DESC)';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages(conversation_id, created_at ASC)';
  END IF;

  IF to_regclass('public.journal_entries') IS NOT NULL THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_journal_user_created ON public.journal_entries(user_id, created_at DESC)';
  END IF;
END $$;

ALTER TABLE IF EXISTS public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.daily_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.users ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.journal_entries') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'journal_entries' AND policyname = 'journal_entries_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY journal_entries_owner_all ON public.journal_entries
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.messages') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messages' AND policyname = 'messages_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY messages_owner_all ON public.messages
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.conversations') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'conversations' AND policyname = 'conversations_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY conversations_owner_all ON public.conversations
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.daily_checkins') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_checkins' AND policyname = 'daily_checkins_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY daily_checkins_owner_all ON public.daily_checkins
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.check_ins') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'check_ins' AND policyname = 'check_ins_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY check_ins_owner_all ON public.check_ins
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF to_regclass('public.users') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users' AND policyname = 'users_owner_all'
  ) THEN
    EXECUTE 'CREATE POLICY users_owner_all ON public.users
      FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id)';
  END IF;
END $$;

