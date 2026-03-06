alter table public.journal_entries
  add column if not exists ai_reflection text;
