-- Global Brain (beta memory, Layer 1): one row per signed-in user holding the
-- curated memory items. Guests (anonymous sessions) never write here.
create table if not exists user_brain (
  user_id uuid primary key references auth.users(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table user_brain enable row level security;

create policy "own user brain" on user_brain for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
