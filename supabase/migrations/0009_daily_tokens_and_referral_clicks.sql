-- Daily token tracking (server-enforced) and referral link click tracking.
-- Tokens use their own reset timestamp so the voice reset (0008) cannot
-- clear the token counter, and the reverse is also true.

alter table profiles add column if not exists tokens_used_today int not null default 0;
alter table profiles add column if not exists tokens_reset_at timestamptz not null default now();

-- Lazy daily reset. Creates the profile row if missing, so guest accounts
-- (anonymous auth users) are counted too. Returns today's token total.
create or replace function roll_daily_tokens(p_user_id uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_used int;
begin
  insert into profiles (id)
  select id from auth.users where id = p_user_id
  on conflict (id) do nothing;

  update profiles
    set tokens_used_today = 0, tokens_reset_at = now()
    where id = p_user_id
      and (tokens_reset_at at time zone 'utc')::date < (now() at time zone 'utc')::date;

  select tokens_used_today into v_used from profiles where id = p_user_id;
  return coalesce(v_used, 0);
end;
$$;

-- Same behaviour as 0006, plus the daily token counter on the profile.
create or replace function log_request(
  p_user_id uuid,
  p_mode text,
  p_feature text,
  p_prompt_tokens int,
  p_completion_tokens int,
  p_cost_usd numeric,
  p_intent_tag text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  day_total numeric;
  cap numeric;
begin
  insert into request_logs (user_id, mode, feature, prompt_tokens, completion_tokens, cost_usd, intent_tag)
  values (p_user_id, p_mode, p_feature, p_prompt_tokens, p_completion_tokens, p_cost_usd, p_intent_tag);

  if p_user_id is not null then
    perform roll_daily_tokens(p_user_id);
    update profiles
      set tokens_used_today = tokens_used_today + greatest(p_prompt_tokens, 0) + greatest(p_completion_tokens, 0)
      where id = p_user_id;
  end if;

  select coalesce(sum(cost_usd), 0) into day_total
  from request_logs where created_at >= date_trunc('day', now() at time zone 'utc');

  select (value #>> '{}')::numeric into cap
  from system_config where key = 'daily_budget_usd';

  if cap is not null and day_total >= cap then
    update system_config set value = 'true', updated_at = now()
    where key = 'circuit_breaker_active' and value <> 'true';
  end if;
end;
$$;
revoke all on function log_request(uuid, text, text, int, int, numeric, text) from public, anon, authenticated;
grant execute on function log_request(uuid, text, text, int, int, numeric, text) to service_role;

revoke all on function roll_daily_tokens(uuid) from public, anon, authenticated;
grant execute on function roll_daily_tokens(uuid) to service_role;

-- Referral link clicks. Recorded by the public ?ref= landing, before sign-up.
create table if not exists referral_clicks (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_clicks_referrer on referral_clicks (referrer_id, created_at);
alter table referral_clicks enable row level security;

create or replace function record_referral_click(p_code text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
begin
  select id into v_referrer from profiles where referral_code = trim(p_code);
  if not found then
    return false;
  end if;
  insert into referral_clicks (referrer_id) values (v_referrer);
  return true;
end;
$$;

revoke all on function record_referral_click(text) from public, anon, authenticated;
grant execute on function record_referral_click(text) to service_role;
