CREATE TABLE IF NOT EXISTS public.user_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fact text NOT NULL,
  source text NOT NULL DEFAULT 'chat',
  confidence real NOT NULL DEFAULT 0.65,
  is_active boolean NOT NULL DEFAULT true,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_context_fact_not_empty CHECK (char_length(trim(fact)) > 0),
  CONSTRAINT user_context_confidence_range CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_context_user_fact
  ON public.user_context(user_id, fact);

CREATE INDEX IF NOT EXISTS idx_user_context_user_last_seen
  ON public.user_context(user_id, last_seen_at DESC);

ALTER TABLE public.user_context ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_context' AND policyname = 'user_context_owner_all'
  ) THEN
    CREATE POLICY user_context_owner_all
      ON public.user_context
      FOR ALL
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.touch_user_context_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_context_updated_at ON public.user_context;

CREATE TRIGGER trg_user_context_updated_at
BEFORE UPDATE ON public.user_context
FOR EACH ROW
EXECUTE FUNCTION public.touch_user_context_updated_at();
