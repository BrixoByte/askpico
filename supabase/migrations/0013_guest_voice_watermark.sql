-- Guest voice trial billing fix (Round 25): last_touch_at becomes a "billed through"
-- watermark instead of a "last seen" timestamp. It advances only by the seconds that
-- were actually charged, so time a request fails to bill stays in the elapsed window
-- and the next successful call can still charge it. Previously every touch moved the
-- anchor to now and silently discarded any unbilled gap (e.g. a dropped heartbeat).
--
-- The charge is still capped by: the claimed seconds (client-reported active time),
-- the wall-clock time since the watermark, p_max_step per request, and the remaining
-- allowance. A client can never be charged for more time than really passed.
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
  v_anchor timestamptz;
  v_elapsed int;
  v_step int;
begin
  insert into guest_voice_usage (user_id) values (p_user_id) on conflict (user_id) do nothing;
  select * into v_row from guest_voice_usage where user_id = p_user_id for update;

  if not p_touch and p_claimed <= 0 then
    return json_build_object('status', 'ok', 'used', v_row.used_seconds,
      'remaining', greatest(p_limit_seconds - v_row.used_seconds, 0), 'charged', 0);
  end if;

  if v_row.used_seconds >= p_limit_seconds then
    return json_build_object('status', 'exhausted', 'used', v_row.used_seconds, 'remaining', 0, 'charged', 0);
  end if;

  -- A null watermark means this is the first touch: start billing from now.
  v_anchor := coalesce(v_row.last_touch_at, v_now);
  v_elapsed := greatest(floor(extract(epoch from (v_now - v_anchor)))::int, 0);
  v_step := least(greatest(p_claimed, 0), v_elapsed, p_max_step, p_limit_seconds - v_row.used_seconds);

  update guest_voice_usage
    set used_seconds = used_seconds + v_step,
        -- The watermark only moves forward by what was billed; unbilled time stays claimable.
        last_touch_at = case when p_touch then v_anchor + make_interval(secs => v_step) else last_touch_at end,
        updated_at = v_now
    where user_id = p_user_id;

  return json_build_object('status', 'ok', 'used', v_row.used_seconds + v_step,
    'remaining', p_limit_seconds - v_row.used_seconds - v_step, 'charged', v_step);
end;
$$;

revoke all on function guest_voice_debit(uuid, int, int, int, boolean) from public, anon, authenticated;
grant execute on function guest_voice_debit(uuid, int, int, int, boolean) to service_role;

notify pgrst, 'reload schema';
