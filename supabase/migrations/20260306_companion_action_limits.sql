CREATE TABLE IF NOT EXISTS public.companion_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_action_logs_user_created
  ON public.companion_action_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_companion_action_logs_user_action_created
  ON public.companion_action_logs(user_id, action, created_at DESC);

ALTER TABLE public.companion_action_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'companion_action_logs'
      AND policyname = 'companion_action_logs_owner_all'
  ) THEN
    CREATE POLICY companion_action_logs_owner_all
      ON public.companion_action_logs
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
