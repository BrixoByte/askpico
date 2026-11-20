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

-- SOURCE NOTE: definition copied verbatim from supabase/migrations/0008_voice_quota.sql
-- (last applied version). pg_get_functiondef is not callable via PostgREST and no SQL
-- executor exists on this machine (no psql/pg). If the function was edited in the
-- Supabase dashboard after 0008, that change is not visible here.
