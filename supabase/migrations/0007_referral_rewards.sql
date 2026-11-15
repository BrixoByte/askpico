-- Referral rewards based on real activity, with anti-abuse checks (beta).
-- A reward is granted only after the referred user verifies email or completes
-- a voice session. Every claim and decision is written to referral_audit.

alter table profiles add column if not exists referral_code text;
alter table profiles add column if not exists referred_by text;
create index if not exists idx_profiles_referral_code on profiles (referral_code)
  where referral_code is not null;

alter table profiles add column if not exists email_verified boolean not null default false;
alter table profiles add column if not exists voice_sessions_completed int not null default 0;
alter table profiles add column if not exists bonus_voice_seconds bigint not null default 0;
alter table profiles add column if not exists is_flagged boolean not null default false;
alter table profiles add column if not exists device_fingerprint text;
alter table profiles add column if not exists signup_ip_hash text;

create table if not exists referrals (
  id bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referred_id uuid not null unique references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded', 'disqualified')),
  reward_seconds int not null default 0,
  disqualify_reason text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists idx_referrals_referrer on referrals (referrer_id, status);
alter table referrals enable row level security;

create table if not exists referral_audit (
  id bigint generated always as identity primary key,
  referral_id bigint references referrals(id) on delete set null,
  referrer_id uuid references auth.users(id) on delete set null,
  referred_id uuid references auth.users(id) on delete set null,
  event text not null,
  result text not null,
  reason text,
  created_at timestamptz not null default now()
);
create index if not exists idx_referral_audit_created on referral_audit (created_at);
alter table referral_audit enable row level security;

-- Backfill referrals that were claimed before this migration.
insert into referrals (referrer_id, referred_id)
select p.referred_by::uuid, p.id
from profiles p
join auth.users r on r.id::text = p.referred_by
where p.referred_by is not null and p.referred_by <> p.id::text
on conflict (referred_id) do nothing;

-- Claim: records the pending referral. Self-referrals are stored as disqualified.
create or replace function claim_referral(p_user_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_already text;
begin
  if p_code is null or trim(p_code) = '' then
    return json_build_object('status', 'invalid');
  end if;

  select id into v_referrer from profiles where referral_code = trim(p_code);
  if not found then
    return json_build_object('status', 'invalid');
  end if;

  if v_referrer = p_user_id then
    insert into referrals (referrer_id, referred_id, status, disqualify_reason, completed_at)
    values (v_referrer, p_user_id, 'disqualified', 'self_referral', now())
    on conflict (referred_id) do nothing;
    insert into referral_audit (referrer_id, referred_id, event, result, reason)
    values (v_referrer, p_user_id, 'claim', 'disqualified', 'self_referral');
    return json_build_object('status', 'self');
  end if;

  select referred_by into v_already from profiles where id = p_user_id;
  if v_already is not null then
    return json_build_object('status', 'repeat');
  end if;

  update profiles set referred_by = v_referrer::text where id = p_user_id;

  insert into referrals (referrer_id, referred_id)
  values (v_referrer, p_user_id)
  on conflict (referred_id) do nothing;

  insert into referral_audit (referrer_id, referred_id, event, result)
  values (v_referrer, p_user_id, 'claim', 'pending');

  insert into reward_events (user_id, kind, amount, meta)
  values (
    v_referrer,
    'referral_signup',
    0,
    json_build_object('referred_user', p_user_id, 'code', trim(p_code))
  );

  return json_build_object('status', 'claimed');
end;
$$;

-- Trigger engine: called after a qualifying activity. Only a pending referral
-- can be completed, so repeated calls are harmless.
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

-- Marks the email as verified and runs the reward check on confirmation.
create or replace function handle_email_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update profiles set email_verified = true where id = new.id;
  perform complete_referral_reward(new.id, 'email_verified');
  return new;
end;
$$;

drop trigger if exists on_email_verified on auth.users;
create trigger on_email_verified
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function handle_email_verified();

revoke all on function claim_referral(uuid, text) from public, anon, authenticated;
grant execute on function claim_referral(uuid, text) to service_role;
revoke all on function complete_referral_reward(uuid, text) from public, anon, authenticated;
grant execute on function complete_referral_reward(uuid, text) to service_role;
