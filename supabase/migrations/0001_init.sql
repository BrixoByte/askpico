-- Pico: persistent data schema for Supabase (Postgres).
-- Temporary data stays local and is NOT stored here: backend rate limiter (memory),
-- image fallback Map (memory), artifact UI state that is not persisted, and OAuth tokens (memory).

create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text,
  auto_title boolean not null default true,
  advanced_mode boolean not null default false,
  enter_to_submit boolean not null default true,
  inline_latex boolean not null default false,
  markdown_mode boolean not null default true,
  count_total_tokens boolean not null default false,
  hide_menu_options boolean not null default false,
  hide_side_menu boolean not null default false,
  first_visit boolean not null default true,
  default_chat_config jsonb,
  default_system_message text not null default '',
  api_endpoint text,
  updated_at timestamptz not null default now()
);

create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  expanded boolean not null default true,
  "order" int not null default 0,
  color text,
  created_at timestamptz not null default now()
);

create table if not exists chats (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  folder_id uuid references folders(id) on delete set null,
  title text not null default '',
  title_set boolean not null default false,
  config jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references chats(id) on delete cascade,
  position int not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null default '',
  image jsonb,
  created_at timestamptz not null default now(),
  unique (chat_id, position)
);

create table if not exists prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists token_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  model text not null,
  prompt_tokens bigint not null default 0,
  completion_tokens bigint not null default 0,
  primary key (user_id, model)
);

create table if not exists artifacts (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid not null references chats(id) on delete cascade,
  message_index int not null,
  title text,
  type text not null check (type in ('code', 'preview')),
  language text,
  file_path text,
  content text not null,
  created_at timestamptz not null default now()
);

create table if not exists artifact_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id uuid not null references chats(id) on delete cascade,
  key text not null,
  value text,
  updated_at timestamptz not null default now(),
  primary key (user_id, chat_id, key)
);

create table if not exists studio_items (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  provider text,
  aspect_ratio text,
  status text not null check (status in ('loading', 'done', 'error')),
  image_path text,
  mime_type text,
  error text,
  created_at timestamptz not null default now()
);

create table if not exists agent_messages (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  agent_id text not null,
  chat_id text not null,
  turn int not null default -1,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_agent_messages_lookup on agent_messages (user_id, agent_id, chat_id, turn);
create index if not exists idx_chats_user on chats (user_id, updated_at desc);
create index if not exists idx_messages_chat on messages (chat_id, position);

alter table profiles enable row level security;
alter table user_settings enable row level security;
alter table folders enable row level security;
alter table chats enable row level security;
alter table messages enable row level security;
alter table prompts enable row level security;
alter table token_usage enable row level security;
alter table artifacts enable row level security;
alter table artifact_state enable row level security;
alter table studio_items enable row level security;
alter table agent_messages enable row level security;

create policy "own profile" on profiles for all
  using (auth.uid() = id) with check (auth.uid() = id);

create policy "own settings" on user_settings for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own folders" on folders for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own chats" on chats for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own messages" on messages for all
  using (exists (select 1 from chats c where c.id = messages.chat_id and c.user_id = auth.uid()))
  with check (exists (select 1 from chats c where c.id = messages.chat_id and c.user_id = auth.uid()));

create policy "own prompts" on prompts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own token usage" on token_usage for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own artifacts" on artifacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own artifact state" on artifact_state for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own studio items" on studio_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own agent messages" on agent_messages for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Guest data retention: anonymous (guest) users whose last activity is older than 7 days
-- are removed with their rows (ON DELETE CASCADE). Run from a scheduled job (pg_cron or Supabase Scheduled Function).
create or replace function purge_inactive_guests()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  removed integer;
begin
  delete from auth.users
  where is_anonymous = true
    and coalesce(last_sign_in_at, created_at) < now() - interval '7 days';
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function purge_inactive_guests() from public, anon, authenticated;

insert into storage.buckets (id, name, public)
values ('images', 'images', false)
on conflict (id) do nothing;

create policy "own images read" on storage.objects for select
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own images write" on storage.objects for insert
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own images delete" on storage.objects for delete
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
