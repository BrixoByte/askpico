-- Server-side voice quota (beta, Step 5).
-- Daily usage is counted on the server. A nightly reset happens lazily on the
-- first call after the UTC day changes. Referral bonus seconds extend the cap.
-- Flagged accounts neither earn nor use bonus seconds while flagged.

alter table profiles add column if not exists voice_seconds_used_today int not null default 0;
alter table profiles add column if not exists last_reset_timestamp timestamptz not null default now();

-- Check and debit in one locked transaction, so concurrent heartbeats cannot overspend.
-- p_limit_seconds null means unlimited (ultra). p_increment 0 is a read-only check.
create or replace function voice_quota_debit(
  p_user_id uuid,
  p_limit_seconds int,
  p_increment int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
  v_used int;
  v_bonus bigint;
  v_allowed bigint;
begin
  select * into v_profile from profiles where id = p_user_id for update;
  if not found then
    return json_build_object('status', 'no_profile');
  end if;

  v_used := v_profile.voice_seconds_used_today;
  if (v_profile.last_reset_timestamp at time zone 'utc')::date < (now() at time zone 'utc')::date then
    v_used := 0;
    update profiles
      set voice_seconds_used_today = 0, last_reset_timestamp = now()
      where id = p_user_id;
  end if;

  v_bonus := case when v_profile.is_flagged then 0 else v_profile.bonus_voice_seconds end;

  if p_limit_seconds is null then
    v_allowed := null;
  else
    v_allowed := p_limit_seconds + v_bonus;
    if v_used >= v_allowed then
      return json_build_object('status', 'exhausted', 'used', v_used, 'allowed', v_allowed, 'remaining', 0);
    end if;
  end if;

  v_used := v_used + greatest(p_increment, 0);
  update profiles set voice_seconds_used_today = v_used where id = p_user_id;

  return json_build_object(
    'status', 'ok',
    'used', v_used,
    'allowed', v_allowed,
    'remaining', case when v_allowed is null then null else greatest(v_allowed - v_used, 0) end
  );
end;
$$;

-- Redefines the reward trigger from 0007. A flagged account on either side
-- freezes the pending referral. Nothing is credited or disqualified, so an
-- admin clearing the flag lets the next activity complete it.
create or replace function complete_referral_reward(p_user_id uuid, p_trigger text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r referrals%rowtype;
  v_referred profiles%rowtype;
  v_reason text := null;
  v_reward constant int := 1800;
begin
  select * into r from referrals
  where referred_id = p_user_id and status = 'pending'
  for update;
  if not found then
    return json_build_object('status', 'none');
  end if;

  select * into v_referred from profiles where id = p_user_id;

  if not (coalesce(v_referred.email_verified, false) or coalesce(v_referred.voice_sessions_completed, 0) >= 1) then
    insert into referral_audit (referral_id, referrer_id, referred_id, event, result, reason)
    values (r.id, r.referrer_id, p_user_id, p_trigger, 'not_qualified', 'no_real_activity');
    return json_build_object('status', 'pending');
  end if;

  if v_referred.is_flagged or exists (
    select 1 from profiles where id = r.referrer_id and is_flagged
  ) then
    insert into referral_audit (referral_id, referrer_id, referred_id, event, result, reason)
    values (r.id, r.referrer_id, p_user_id, p_trigger, 'frozen', 'flagged_account');
    return json_build_object('status', 'frozen');
  end if;

  if r.referrer_id = p_user_id then
    v_reason := 'self_referral';
  elsif exists (
    select 1 from profiles p
    where p.id <> p_user_id
      and (
        (v_referred.device_fingerprint is not null and p.device_fingerprint = v_referred.device_fingerprint)
        or (v_referred.signup_ip_hash is not null and p.signup_ip_hash = v_referred.signup_ip_hash)
      )
      and (
        p.id = r.referrer_id
        or p.id in (select referred_id from referrals where referrer_id = r.referrer_id and status = 'rewarded')
      )
  ) then
    v_reason := 'repeat_account';
  end if;

  if v_reason is not null then
    update referrals
      set status = 'disqualified', disqualify_reason = v_reason, completed_at = now()
      where id = r.id;
    if v_reason = 'repeat_account' then
      update profiles set is_flagged = true where id = p_user_id;
    end if;
    insert into referral_audit (referral_id, referrer_id, referred_id, event, result, reason)
    values (r.id, r.referrer_id, p_user_id, p_trigger, 'disqualified', v_reason);
    return json_build_object('status', 'disqualified');
  end if;

  update referrals
    set status = 'rewarded', reward_seconds = v_reward, completed_at = now()
    where id = r.id;
  update profiles
    set bonus_voice_seconds = bonus_voice_seconds + v_reward
    where id in (r.referrer_id, p_user_id);
  insert into referral_audit (referral_id, referrer_id, referred_id, event, result)
  values (r.id, r.referrer_id, p_user_id, p_trigger, 'rewarded');

  return json_build_object('status', 'rewarded');
end;
$$;

revoke all on function voice_quota_debit(uuid, int, int) from public, anon, authenticated;
grant execute on function voice_quota_debit(uuid, int, int) to service_role;
revoke all on function complete_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function complete_referral_reward(uuid, text) to service_role;
