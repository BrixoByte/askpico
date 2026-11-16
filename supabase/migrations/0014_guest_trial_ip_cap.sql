-- Guest voice trial IP cap (Round 25): limits how many fresh full-length voice
-- trials one client IP can receive per rolling 24 hours. Mobile CGNAT means many
-- real users share an IP, so the cap is intentionally soft: over-cap guests get a
-- reduced trial, never zero, and chat is unaffected.
--
-- Only keyed IP hashes are stored — never raw IPs. The API writes here as
-- service_role; anon/authenticated roles get no access.

create table if not exists guest_trial_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ip_hash text not null,
  granted_seconds int not null check (granted_seconds > 0),
  created_at timestamptz not null default now()
);

alter table guest_trial_grants enable row level security;
-- No policies on purpose: no direct client access.

-- The cap check counts distinct grants per ip_hash inside the rolling window.
create index if not exists guest_trial_grants_ip_idx
  on guest_trial_grants (ip_hash, created_at);
