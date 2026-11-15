-- Admin panel foundation: roles, observability tables, system flags.
-- All admin-managed tables are service-role only; no anon/authenticated
-- policies are granted — the backend writes/reads them with the service key.
-- The admin PANEL never talks to these tables directly; it goes through
-- /api/admin/* which requires is_admin().

-- ── Roles ────────────────────────────────────────────────────────────
alter table profiles add column if not exists role text not null default 'user'
  check (role in ('user', 'admin'));

create index if not exists idx_profiles_role on profiles (role)
  where role = 'admin';

-- Cheap boolean used by policies and the backend to verify admin access.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- ── Global system flags (kill switch, circuit breaker, budget) ──────
create table if not exists system_config (
  key text primary key,
  value jsonb not null default 'null',
  updated_at timestamptz not null default now()
);
alter table system_config enable row level security;

-- Seed the flags the watchdog/kill-switch use.
insert into system_config (key, value) values
  ('llm_requests_paused', 'false'),
  ('circuit_breaker_active', 'false'),
  ('monthly_budget_usd', '50.00'),
  ('daily_budget_usd', '1.66')
on conflict (key) do nothing;

-- ── Per-user enforcement state (throttle / ban) ──────────────────────
create table if not exists user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'throttled', 'banned')),
  daily_token_cap bigint,          -- null = plan default
  flagged boolean not null default false, -- set by the intent classifier
  flag_reason text,
  updated_at timestamptz not null default now()
);
alter table user_limits enable row level security;
-- Users may read their own status (lets the app show "banned/throttled" UX).
create policy "read own limits" on user_limits for select
  using (auth.uid() = user_id);

-- ── Request logs + intent classification (classifier worker) ────────
create table if not exists request_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  mode text,
  feature text not null default 'text' check (feature in ('text', 'voice', 'image', 'agent')),
  prompt_tokens int not null default 0,
  completion_tokens int not null default 0,
  cost_usd numeric(10,6) not null default 0,
  intent_tag text check (intent_tag in ('coding', 'casual', 'spam', 'stress_test')),
  rated smallint check (rated in (-1, 1)),      -- thumbs down / up
  feedback_text text,
  created_at timestamptz not null default now()
);
create index if not exists idx_request_logs_day on request_logs (created_at);
create index if not exists idx_request_logs_user on request_logs (user_id);
create index if not exists idx_request_logs_intent on request_logs (intent_tag)
  where intent_tag is not null;
alter table request_logs enable row level security;

-- ── Telemetry batches (aggregator worker) ───────────────────────────
create table if not exists telemetry_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event text not null,
  props jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_telemetry_day on telemetry_events (created_at);
alter table telemetry_events enable row level security;

-- ── Crash/error silencer (crashLogger worker) ───────────────────────
create table if not exists system_error_logs (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  source text not null,              -- e.g. 'voice', 'room_db', 'api_transport'
  message text not null,
  stack text,
  context jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_system_errors_day on system_error_logs (created_at);
alter table system_error_logs enable row level security;

-- ── Audit trail: every admin action is recorded ─────────────────────
create table if not exists admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid not null references auth.users(id) on delete cascade,
  action text not null,              -- e.g. 'ban_user', 'create_coupon', 'kill_switch'
  target_user_id uuid references auth.users(id) on delete set null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table admin_audit_log enable row level security;

-- ── Helper: record a request + its cost (used by /api/chat) ─────────
-- Also auto-trips the circuit breaker when the daily budget is crossed.
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
revoke all on function log_request(uuid, text, text, int, int, numeric, text) from public, anon, authenticated;
grant execute on function log_request(uuid, text, text, int, int, numeric, text) to service_role;
