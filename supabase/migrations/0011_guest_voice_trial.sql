-- Guest voice trial (Round 24): a lifetime allowance of 120 seconds of voice per anonymous user.
-- Usage is keyed by the anonymous auth user id, so clearing app storage does not reset it.
-- Only the API (service_role) touches this table.

create table if not exists guest_voice_usage (
  user_id uuid primary key references auth.users(id) on delete cascade,
  used_seconds int not null default 0 check (used_seconds >= 0),
  last_touch_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table guest_voice_usage enable row level security;
-- No policies on purpose: anon and authenticated roles get no access.

-- p_touch false with p_claimed 0 is a read-only balance check.
-- Otherwise the charge is capped by: the claimed seconds, the wall-clock time since the
-- last touch (so a client cannot claim more time than really passed), p_max_step per
-- request, and the remaining allowance. A session that is never touched costs nothing more.
create or replace function guest_voice_debit(
  p_user_id uuid,
  p_limit_seconds int,
  p_claimed int,
  p_max_step int,
  p_touch boolean
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row guest_voice_usage%rowtype;
  v_now timestamptz := now();
  v_elapsed int;
  v_step int;
begin
  insert into guest_voice_usage (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_row from guest_voice_usage where user_id = p_user_id for update;

  if not p_touch and p_claimed <= 0 then
    return json_build_object('status', 'ok', 'used', v_row.used_seconds,
      'remaining', greatest(p_limit_seconds - v_row.used_seconds, 0));
  end if;

  if v_row.used_seconds >= p_limit_seconds then
    return json_build_object('status', 'exhausted', 'used', v_row.used_seconds, 'remaining', 0);
  end if;

  v_elapsed := case when v_row.last_touch_at is null then 0
    else floor(extract(epoch from (v_now - v_row.last_touch_at)))::int end;
  v_step := least(greatest(p_claimed, 0), v_elapsed, p_max_step, p_limit_seconds - v_row.used_seconds);

  update guest_voice_usage
    set used_seconds = used_seconds + v_step,
        last_touch_at = case when p_touch then v_now else last_touch_at end,
        updated_at = v_now
    where user_id = p_user_id;

  return json_build_object('status', 'ok', 'used', v_row.used_seconds + v_step,
    'remaining', p_limit_seconds - v_row.used_seconds - v_step);
end;
$$;

revoke all on function guest_voice_debit(uuid, int, int, int, boolean) from public, anon, authenticated;
grant execute on function guest_voice_debit(uuid, int, int, int, boolean) to service_role;
