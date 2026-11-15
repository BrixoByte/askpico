-- Theme preference for signed-in users. Guests keep theme in the browser cookie only.
create table if not exists user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  updated_at timestamptz not null default now()
);

alter table user_preferences enable row level security;

create policy "own user preferences" on user_preferences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
