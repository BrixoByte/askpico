-- Round 64: remove voice DB objects; referral reward becomes text-based.
-- Backup: NONE — owner confirmed free plan, no PITR (accepted risk, see
-- testing/round64/PROGRESS.md). Objects dropped here:
--   functions : guest_voice_debit(uuid,int,int,int,boolean), voice_quota_debit(uuid,int,int)
--   tables    : guest_voice_usage, guest_trial_grants
--   columns   : profiles.voice_seconds_used_today, profiles.last_reset_timestamp
-- Kept on purpose (SHARED, frozen): profiles.bonus_voice_seconds,
-- profiles.voice_sessions_completed, referrals.reward_seconds — never read or
-- written again by the trigger; existing balances stay frozen.
-- PLACEHOLDER: change REFERRAL_REWARD_TEXT_UNITS in one place — final pricing pending.

-- Single source of the referral reward amount, in text units.
-- PLACEHOLDER, final pricing pending — edit this function only.
create or replace function public.referral_reward_text_units()
returns int
language sql
immutable
as $$ select 100 $$;

-- Same signature, return type, security mode and search_path as the 0008 version.
-- Voice changes only: qualification is now email-verified only (no
-- voice_sessions_completed read); no bonus_voice_seconds or reward_seconds write;
-- the reward is recorded in the existing reward_events ledger as a text unit
-- amount (kind 'referral_activity' was already allowed by the kind check).
create or replace function public.complete_referral_reward(p_user_id uuid, p_trigger text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r referrals%rowtype;
  v_referred profiles%rowtype;
  v_reason text := null;
begin
  select * into r from referrals
  where referred_id = p_user_id and status = 'pending'
  for update;
  if not found then
    return json_build_object('status', 'none');
  end if;

  select * into v_referred from profiles where id = p_user_id;

  if not coalesce(v_referred.email_verified, false) then
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
    set status = 'rewarded', completed_at = now()
    where id = r.id;
  -- Text reward credit: one ledger row per side, amount from the single
  -- placeholder function. Existing bonus_voice_seconds balances stay frozen.
  insert into reward_events (user_id, kind, amount, meta)
  select uid, 'referral_activity', public.referral_reward_text_units(),
         json_build_object(
           'referred_user', p_user_id,
           'unit', 'text_tokens',
           'side', case when uid = r.referrer_id then 'referrer' else 'referred' end,
           'placeholder', true
         )
  from unnest(array[r.referrer_id, p_user_id]) as uid;
  insert into referral_audit (referral_id, referrer_id, referred_id, event, result)
  values (r.id, r.referrer_id, p_user_id, p_trigger, 'rewarded');

  return json_build_object('status', 'rewarded');
end;
$$;

-- Voice-only objects confirmed SAFE in testing/round64/DEPENDENCY.md.
-- Functions first (they reference the dropped table/columns), then tables, then columns.
drop function if exists public.guest_voice_debit(uuid, int, int, int, boolean);
drop function if exists public.voice_quota_debit(uuid, int, int);

drop table if exists public.guest_voice_usage;
drop table if exists public.guest_trial_grants;

alter table public.profiles drop column if exists voice_seconds_used_today;
alter table public.profiles drop column if exists last_reset_timestamp;
