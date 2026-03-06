-- Companion chat storage
create table if not exists public.companion_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists companion_conversations_user_id_idx
  on public.companion_conversations(user_id, created_at desc);

create table if not exists public.companion_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.companion_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists companion_messages_conversation_id_idx
  on public.companion_messages(conversation_id, created_at asc);

alter table public.companion_conversations enable row level security;
alter table public.companion_messages enable row level security;

drop policy if exists "Users can read own conversations" on public.companion_conversations;
create policy "Users can read own conversations"
  on public.companion_conversations
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own conversations" on public.companion_conversations;
create policy "Users can insert own conversations"
  on public.companion_conversations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own messages" on public.companion_messages;
create policy "Users can read own messages"
  on public.companion_messages
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.companion_messages;
create policy "Users can insert own messages"
  on public.companion_messages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

