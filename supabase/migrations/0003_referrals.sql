-- Referral tracking: ?ref=<code> captured client-side (localStorage) and stored
-- on the profile at signup so referrals can be attributed and rewarded later.
alter table profiles add column if not exists referral_code text;
alter table profiles add column if not exists referred_by text;

create index if not exists idx_profiles_referral_code on profiles (referral_code)
  where referral_code is not null;
