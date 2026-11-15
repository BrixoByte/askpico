-- Model auto-routing: plan lookup and daily quota counters.
-- Written only by the backend (service role). RLS is enabled with no policies,
-- so anon and authenticated clients cannot read or change these rows.

create table if not exists subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('free', 'weekly', 'monthly')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists routing_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  mode text not null check (mode in ('smart', 'deep_fast', 'deep_pro')),
  count int not null default 0,
  primary key (user_id, day, mode)
);

create table if not exists routing_global_usage (
  day date not null,
  mode text not null check (mode in ('smart', 'deep_fast', 'deep_pro')),
  count int not null default 0,
  primary key (day, mode)
);

alter table subscriptions enable row level security;
alter table routing_usage enable row level security;
alter table routing_global_usage enable row level security;

-- Atomically reserves one request in a mode. Returns false when the user's daily
-- limit or the global circuit-breaker cap is reached. The global counter is
-- rolled back if the user limit rejects the request.
create or replace function consume_routing_mode(
  p_user_id uuid,
  p_mode text,
  p_user_limit int,
  p_global_cap int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into routing_global_usage (day, mode, count)
  values (current_date, p_mode, 0)
  on conflict (day, mode) do nothing;

  update routing_global_usage
  set count = count + 1
  where day = current_date and mode = p_mode and count < p_global_cap;
  if not found then
    return false;
  end if;

  insert into routing_usage (user_id, day, mode, count)
  values (p_user_id, current_date, p_mode, 0)
  on conflict (user_id, day, mode) do nothing;

  update routing_usage
  set count = count + 1
  where user_id = p_user_id and day = current_date and mode = p_mode and count < p_user_limit;
  if not found then
    update routing_global_usage
    set count = count - 1
    where day = current_date and mode = p_mode;
    return false;
  end if;

  return true;
end;
$$;

revoke all on function consume_routing_mode(uuid, text, int, int) from public, anon, authenticated;
grant execute on function consume_routing_mode(uuid, text, int, int) to service_role;
