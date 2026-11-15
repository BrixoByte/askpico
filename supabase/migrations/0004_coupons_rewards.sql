-- Early-buyer coupons and referral reward events.
-- Written only by the backend (service role). RLS enabled with no policies.

-- 26 one-time codes: 50% off the first 3 months of Pro Monthly.
-- Valid until Dec 31 2026.
create table if not exists coupons (
  code text primary key,
  discount_pct int not null default 50,
  months int not null default 3,
  plan text not null default 'monthly' check (plan in ('weekly', 'monthly')),
  max_redemptions int not null default 1,
  redeemed_count int not null default 0,
  expires_at timestamptz not null default '2026-12-31T23:59:59Z',
  created_at timestamptz not null default now()
);

create table if not exists coupon_redemptions (
  id bigint generated always as identity primary key,
  code text not null references coupons(code),
  user_id uuid not null references auth.users(id) on delete cascade,
  redeemed_at timestamptz not null default now(),
  unique (code)
);

-- Referral rewards are recorded here after real activity confirms them.
-- amount stays 0 until a reward is granted; status explains the outcome.
create table if not exists reward_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('referral_signup', 'referral_activity')),
  amount int not null default 0,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table coupons enable row level security;
alter table coupon_redemptions enable row level security;
alter table reward_events enable row level security;

-- Atomic coupon redemption: validates, then marks the code used.
-- Returns a json object with status and discount details.
create or replace function redeem_coupon(p_user_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  c coupons%rowtype;
begin
  select * into c from coupons where code = upper(trim(p_code));
  if not found then
    return json_build_object('status', 'invalid');
  end if;
  if c.expires_at < now() then
    return json_build_object('status', 'expired');
  end if;
  if c.redeemed_count >= c.max_redemptions then
    return json_build_object('status', 'used');
  end if;

  update coupons
  set redeemed_count = redeemed_count + 1
  where code = c.code and redeemed_count < c.max_redemptions;
  if not found then
    return json_build_object('status', 'used');
  end if;

  insert into coupon_redemptions (code, user_id) values (c.code, p_user_id);

  return json_build_object(
    'status', 'redeemed',
    'discount_pct', c.discount_pct,
    'months', c.months,
    'plan', c.plan
  );
end;
$$;

-- Links a referred user to their referrer. Self and repeat referrals get no
-- reward. Returns a status so the server can respond precisely.
create or replace function claim_referral(p_user_id uuid, p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer_id uuid;
  already uuid;
begin
  if p_code is null or trim(p_code) = '' then
    return json_build_object('status', 'invalid');
  end if;

  select id into referrer_id from profiles where referral_code = trim(p_code);
  if not found then
    return json_build_object('status', 'invalid');
  end if;

  if referrer_id = p_user_id then
    return json_build_object('status', 'self');
  end if;

  select referred_by into already from profiles where id = p_user_id;
  if already is not null then
    return json_build_object('status', 'repeat');
  end if;

  update profiles set referred_by = referrer_id where id = p_user_id;

  -- Record a pending reward for the referrer; real activity confirms it later.
  insert into reward_events (user_id, kind, amount, meta)
  values (
    referrer_id,
    'referral_signup',
    0,
    json_build_object('referred_user', p_user_id, 'code', trim(p_code))
  );

  return json_build_object('status', 'claimed');
end;
$$;

revoke all on function redeem_coupon(uuid, text) from public, anon, authenticated;
grant execute on function redeem_coupon(uuid, text) to service_role;
revoke all on function claim_referral(uuid, text) from public, anon, authenticated;
grant execute on function claim_referral(uuid, text) to service_role;

-- Seed the 26 early-buyer codes.
insert into coupons (code)
select 'EARLY-' || lpad(g::text, 2, '0')
from generate_series(1, 26) as g
on conflict (code) do nothing;
