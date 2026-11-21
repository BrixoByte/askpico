-- 0019: atomic daily token reservations (round 84 fix plan).
-- NOT APPLIED. Apply only after the owner types MIGRATION OK and a backup is confirmed.
-- Dry run first: begin; \i this file; <checks>; rollback;
--
-- Effects:
--  * token_reservations: one row per provider call that reserved tokens.
--  * reserve_daily_tokens: check-and-add in one statement, so concurrent requests
--    cannot all pass the cap. Returns allowed/used/reservation_id.
--  * reconcile_daily_tokens: settles a reservation to the real count (0 releases it).
--  * roll_daily_tokens: unchanged reset rule, plus a guard so the reset cannot run
--    while the user has an open reservation.
--  * log_request: still writes request_logs and the circuit breaker, but no longer
--    changes profiles.tokens_used_today. The counter is changed only by reserve and
--    reconcile. Signature unchanged, so existing callers keep working.

create table if not exists token_reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null check (amount >= 0),
  status text not null default 'open' check (status in ('open', 'settled')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index if not exists idx_token_reservations_open on token_reservations (user_id) where status = 'open';
alter table token_reservations enable row level security;

-- Reset only on an earlier UTC day AND only when no reservation is open.
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
      and (tokens_reset_at at time zone 'utc')::date < (now() at time zone 'utc')::date
      and not exists (
        select 1 from token_reservations r where r.user_id = p_user_id and r.status = 'open'
      );

  select tokens_used_today into v_used from profiles where id = p_user_id;
  return coalesce(v_used, 0);
end;
$$;

-- p_limit null = no cap. Check-and-add is a single UPDATE, so the row lock
-- serialises concurrent reservations.
create or replace function reserve_daily_tokens(p_user_id uuid, p_amount int, p_limit int)
returns table(allowed boolean, used int, reservation_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount int := greatest(coalesce(p_amount, 0), 0);
  v_used int;
  v_id uuid;
begin
  perform roll_daily_tokens(p_user_id);

  update profiles
    set tokens_used_today = tokens_used_today + v_amount
    where id = p_user_id
      and (p_limit is null or tokens_used_today + v_amount <= p_limit)
    returning tokens_used_today into v_used;

  if not found then
    select tokens_used_today into v_used from profiles where id = p_user_id;
    return query select false, coalesce(v_used, 0), null::uuid;
    return;
  end if;

  insert into token_reservations (user_id, amount)
    values (p_user_id, v_amount)
    returning id into v_id;

  return query select true, v_used, v_id;
end;
$$;

-- Settle to the real count. actual = 0 releases the reservation. Only the first
-- settle for a reservation has an effect.
create or replace function reconcile_daily_tokens(p_reservation uuid, p_actual int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  update token_reservations
    set status = 'settled', settled_at = now()
    where id = p_reservation and status = 'open'
    returning user_id, amount into r;

  if not found then
    return;
  end if;

  update profiles
    set tokens_used_today = greatest(tokens_used_today + (greatest(coalesce(p_actual, 0), 0) - r.amount), 0)
    where id = r.user_id;
end;
$$;

-- Same signature and request ledger as before. The counter is no longer touched here.
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

revoke all on function reserve_daily_tokens(uuid, int, int) from public, anon, authenticated;
grant execute on function reserve_daily_tokens(uuid, int, int) to service_role;
revoke all on function reconcile_daily_tokens(uuid, int) from public, anon, authenticated;
grant execute on function reconcile_daily_tokens(uuid, int) to service_role;
revoke all on function roll_daily_tokens(uuid) from public, anon, authenticated;
grant execute on function roll_daily_tokens(uuid) to service_role;
revoke all on function log_request(uuid, text, text, int, int, numeric, text) from public, anon, authenticated;
grant execute on function log_request(uuid, text, text, int, int, numeric, text) to service_role;
