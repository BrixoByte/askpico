// Admin API: every route under /api/admin/* requires profiles.role='admin'.
// The admin panel talks only to these endpoints — never to Supabase tables
// directly — so all privileged writes are validated + audited here.
import express from 'express';
import { z } from 'zod';
import { supabase, getUserFromToken } from '../supabase.js';
import { logger } from '../logger.js';
import { dailyTokenLimit } from '../tokenQuotaPolicy.js';
import { aiSpendRouter, alertsHandler } from './aiSpendRoutes.js';
import { flagRouter } from './flagRoutes.js';
import { infraRouter } from './infraRoutes.js';

export const adminRouter = express.Router();

const bearerToken = (req) =>
  req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;

export const requireAdmin = async (req, res, next) => {
  try {
    const user = await getUserFromToken(bearerToken(req));
    if (!user) return res.status(401).json({ error: 'sign-in session is required' });
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.role !== 'admin') {
      return res.status(403).json({ error: 'admin access required' });
    }
    req.adminUser = user;
    next();
  } catch (err) {
    console.error(`admin auth failed: ${err.message}`);
    res.status(502).json({ error: 'Admin auth is unavailable.' });
  }
};

adminRouter.use(requireAdmin);
adminRouter.use('/ai-spend', aiSpendRouter);
adminRouter.use('/flags', flagRouter);
adminRouter.use('/infra', infraRouter);
adminRouter.get('/alerts', alertsHandler);

// Every mutation is written to admin_audit_log. Failures never block the action.
const audit = (adminId, action, { targetUserId = null, detail = {} } = {}) => {
  supabase
    .from('admin_audit_log')
    .insert({ admin_id: adminId, action, target_user_id: targetUserId, detail })
    .then(({ error }) => {
      if (error) logger.warn(`audit log failed for "${action}": ${error.message}`);
    });
};

// ── System flags (shared with the request path) ──────────────────────

const FLAG_CACHE_MS = 5000;
const flagCache = new Map();

export const getSystemFlag = async (key) => {
  const cached = flagCache.get(key);
  if (cached && Date.now() - cached.at < FLAG_CACHE_MS) return cached.value;
  const { data, error } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw new Error(`system flag read failed: ${error.message}`);
  const value = data?.value === true || data?.value === 'true';
  flagCache.set(key, { value, at: Date.now() });
  return value;
};

const getFlag = async (key) => {
  try {
    return await getSystemFlag(key);
  } catch (err) {
    logger.warn(`flag "${key}" read failed: ${err.message}`);
    return false; // fail open — a config hiccup must not freeze traffic
  }
};

// Throttle/ban state for the request path. Returns { status, dailyTokenCap,
// tokensToday } so /api/chat can enforce suspension + caps cheaply.
export const getUserLimitState = async (userId) => {
  const { data, error } = await supabase
    .from('user_limits')
    .select('status, daily_token_cap')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`user limits read failed: ${error.message}`);
  if (!data) return { status: 'active', dailyTokenCap: null, tokensToday: 0 };
  if (data.status !== 'throttled' || data.daily_token_cap == null) {
    return { status: data.status, dailyTokenCap: data.daily_token_cap, tokensToday: 0 };
  }
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data: usage, error: usageErr } = await supabase
    .from('request_logs')
    .select('prompt_tokens, completion_tokens')
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());
  if (usageErr) throw new Error(`user token read failed: ${usageErr.message}`);
  const tokensToday = (usage ?? []).reduce(
    (sum, r) => sum + (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0),
    0
  );
  return { status: data.status, dailyTokenCap: data.daily_token_cap, tokensToday };
};

// ── Check (login guard for the admin app) ────────────────────────────
adminRouter.get('/check', (req, res) => {
  res.json({ admin: true, email: req.adminUser.email ?? null });
});

// ── Overview stats ───────────────────────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
  try {
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dayStart = new Date(now); dayStart.setUTCHours(0, 0, 0, 0);
    const weekAgo = new Date(now.getTime() - 7 * 86400_000);

    const [month, day, testersRow, flags, configs] = await Promise.all([
      supabase
        .from('request_logs')
        .select('cost_usd, prompt_tokens, completion_tokens')
        .gte('created_at', monthStart.toISOString()),
      supabase
        .from('request_logs')
        .select('cost_usd, prompt_tokens, completion_tokens')
        .gte('created_at', dayStart.toISOString()),
      supabase
        .from('request_logs')
        .select('user_id')
        .gte('created_at', weekAgo.toISOString())
        .not('user_id', 'is', null),
      supabase.from('system_config').select('key, value').in('key', [
        'llm_requests_paused', 'circuit_breaker_active',
      ]),
      supabase.from('system_config').select('key, value').in('key', [
        'monthly_budget_usd', 'daily_budget_usd',
      ]),
    ]);

    const firstErr = [month, day, testersRow, flags, configs].find((r) => r.error);
    if (firstErr) throw new Error(firstErr.error.message);

    const sum = (rows, field) => (rows ?? []).reduce((s, r) => s + Number(r[field] ?? 0), 0);
    const flagMap = Object.fromEntries((flags.data ?? []).map((f) => [f.key, f.value === true || f.value === 'true']));
    const configMap = Object.fromEntries((configs.data ?? []).map((f) => [f.key, Number(f.value)]));

    const paused = flagMap.llm_requests_paused === true;
    const breaker = flagMap.circuit_breaker_active === true;

    res.json({
      monthlySpendUsd: sum(month.data, 'cost_usd'),
      todaySpendUsd: sum(day.data, 'cost_usd'),
      todayTokens: sum(day.data, 'prompt_tokens') + sum(day.data, 'completion_tokens'),
      monthlyBudgetUsd: configMap.monthly_budget_usd ?? 50,
      dailyBudgetUsd: configMap.daily_budget_usd ?? 1.66,
      activeTesters: new Set((testersRow.data ?? []).map((r) => r.user_id)).size,
      status: paused || breaker ? 'breaker' : 'normal',
      killSwitch: paused,
      circuitBreaker: breaker,
    });
  } catch (err) {
    console.error(`admin stats failed: ${err.message}`);
    res.status(502).json({ error: 'Stats are unavailable.' });
  }
});

// ── Users & Plans ────────────────────────────────────────────────────
const listUsersQuery = z.object({
  search: z.string().trim().max(200).optional(),
  plan: z.enum(['all', 'free', 'weekly', 'monthly']).default('all'),
  status: z.enum(['all', 'active', 'throttled', 'banned']).default('all'),
  sort: z.enum(['joined', 'email', 'tokens']).default('joined'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const nowIso = () => new Date().toISOString();
const dayStartUtc = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const monthStartUtc = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); };
const daysAgoUtc = (days) => new Date(Date.now() - days * 86_400_000);

// Effective plan per user: subscriptions row wins, expired or missing → 'free'.
const loadPlanMap = async (ids = null) => {
  let q = supabase.from('subscriptions').select('user_id, plan, expires_at');
  if (ids) q = q.in('user_id', ids);
  const { data, error } = await q;
  if (error) throw new Error(`subscriptions read failed: ${error.message}`);
  const now = Date.now();
  const map = new Map();
  for (const s of data ?? []) {
    const expired = s.expires_at && new Date(s.expires_at).getTime() < now;
    map.set(s.user_id, { plan: expired ? 'free' : s.plan, expiresAt: s.expires_at });
  }
  return map;
};

// PostgREST .in() chokes on empty id lists — short-circuit.
const emptyPage = (page, pageSize) => ({ users: [], total: 0, page, pageSize });

adminRouter.get('/users', async (req, res) => {
  const parsed = listUsersQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad query' });
  const { search, plan, status, sort, dir, page, pageSize } = parsed.data;

  try {
    // Narrow the candidate id set before touching profiles: plan and status
    // live in sibling tables, so filter them first instead of loading everyone.
    const notIn = [];
    const onlyIn = [];
    if (plan !== 'all') {
      const subs = await loadPlanMap();
      const matching = new Set([...subs.entries()].filter(([, v]) => v.plan === plan).map(([id]) => id));
      if (plan === 'free') {
        // Free = no active paid subscription at all.
        const paid = [...subs.entries()].filter(([, v]) => v.plan !== 'free').map(([id]) => id);
        if (paid.length) notIn.push(paid);
      } else {
        onlyIn.push([...matching]);
      }
    }
    if (status !== 'all') {
      const { data: limits, error: lErr } = await supabase
        .from('user_limits')
        .select('user_id, status')
        .neq('status', 'active');
      if (lErr) throw new Error(lErr.message);
      const limited = (limits ?? []).filter((l) => l.status === status).map((l) => l.user_id);
      if (status === 'active') {
        const nonActive = (limits ?? []).map((l) => l.user_id);
        if (nonActive.length) notIn.push(nonActive);
      } else {
        onlyIn.push(limited);
      }
    }

    const sortCol = sort === 'email' ? 'email' : sort === 'tokens' ? 'tokens_used_today' : 'created_at';
    let query = supabase
      .from('profiles')
      .select('id, email, name, created_at, role, tokens_used_today', { count: 'exact' })
      .neq('role', 'admin')
      .order(sortCol, { ascending: dir === 'asc', nullsFirst: false });
    if (search) query = query.ilike('email', `%${search.replace(/[%_]/g, '')}%`);
    for (const ids of onlyIn) {
      if (ids.length === 0) return res.json(emptyPage(page, pageSize));
      query = query.in('id', ids);
    }
    for (const ids of notIn) query = query.not('id', 'in', `(${ids.join(',')})`);

    const from = (page - 1) * pageSize;
    const { data: profiles, count, error: pErr } = await query.range(from, from + pageSize - 1);
    if (pErr) throw new Error(pErr.message);

    const ids = (profiles ?? []).map((p) => p.id);
    const [limits, plans] = await Promise.all([
      ids.length
        ? supabase.from('user_limits').select('user_id, status, daily_token_cap, flagged, flag_reason').in('user_id', ids)
        : Promise.resolve({ data: [], error: null }),
      loadPlanMap(ids.length ? ids : null),
    ]);
    if (limits.error) throw new Error(limits.error.message);
    const limitMap = new Map((limits.data ?? []).map((l) => [l.user_id, l]));

    const users = (profiles ?? []).map((p) => {
      const l = limitMap.get(p.id);
      const planInfo = plans.get(p.id) ?? { plan: 'free', expiresAt: null };
      const tokenLimit = l?.daily_token_cap ?? dailyTokenLimit(planInfo.plan);
      return {
        id: p.id,
        email: p.email,
        name: p.name,
        joinedAt: p.created_at,
        role: p.role,
        plan: planInfo.plan,
        planExpiresAt: planInfo.expiresAt,
        status: l?.status ?? 'active',
        dailyTokenCap: l?.daily_token_cap ?? null,
        tokenLimit,
        tokensToday: p.tokens_used_today ?? 0,
        flagReason: l?.flag_reason ?? null,
      };
    });

    res.json({ users, total: count ?? users.length, page, pageSize });
  } catch (err) {
    console.error(`admin users failed: ${err.message}`);
    res.status(502).json({ error: 'User list is unavailable.' });
  }
});

// Shared loader for GET /users/:id and the PATCH response.
const loadUserDetail = async (userId) => {
  const [profile, subs, limits, usage] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, name, created_at, role, tokens_used_today, tokens_reset_at')
      .eq('id', userId)
      .maybeSingle(),
    supabase.from('subscriptions').select('plan, expires_at, updated_at').eq('user_id', userId).maybeSingle(),
    supabase.from('user_limits').select('status, daily_token_cap, flagged, flag_reason, updated_at').eq('user_id', userId).maybeSingle(),
    supabase
      .from('request_logs')
      .select('created_at, feature, prompt_tokens, completion_tokens, cost_usd')
      .eq('user_id', userId)
      .gte('created_at', daysAgoUtc(30).toISOString())
      .order('created_at', { ascending: true })
      .limit(5000),
  ]);
  const firstErr = [profile, subs, limits, usage].find((r) => r.error);
  if (firstErr) throw new Error(firstErr.error.message);
  if (!profile.data) return null;

  const plan = subs.data && !(subs.data.expires_at && new Date(subs.data.expires_at) < new Date())
    ? subs.data.plan
    : 'free';

  // Collapse per-request logs into a UTC-day series (AI tokens).
  const byDay = new Map();
  for (const r of usage.data ?? []) {
    const d = r.created_at.slice(0, 10);
    const row = byDay.get(d) ?? { day: d, tokens: 0, requests: 0, costUsd: 0 };
    const tokens = (r.prompt_tokens ?? 0) + (r.completion_tokens ?? 0);
    row.tokens += tokens;
    row.requests += 1;
    row.costUsd += Number(r.cost_usd ?? 0);
    byDay.set(d, row);
  }

  return {
    id: profile.data.id,
    email: profile.data.email,
    name: profile.data.name,
    joinedAt: profile.data.created_at,
    role: profile.data.role,
    plan,
    planExpiresAt: subs.data?.expires_at ?? null,
    status: limits.data?.status ?? 'active',
    dailyTokenCap: limits.data?.daily_token_cap ?? null,
    flagReason: limits.data?.flag_reason ?? null,
    quota: {
      tokensToday: profile.data.tokens_used_today ?? 0,
      tokenLimit: limits.data?.daily_token_cap ?? dailyTokenLimit(plan),
    },
    usage30d: [...byDay.values()],
  };
};

adminRouter.get('/users/:id', async (req, res) => {
  const userId = String(req.params.id);
  if (!USER_ID_PATTERN.test(userId)) return res.status(400).json({ error: 'bad user id' });
  try {
    const detail = await loadUserDetail(userId);
    if (!detail) return res.status(404).json({ error: 'user not found' });
    res.json(detail);
  } catch (err) {
    console.error(`admin user detail failed: ${err.message}`);
    res.status(502).json({ error: 'User detail is unavailable.' });
  }
});

const patchUserSchema = z
  .object({
    plan: z.enum(['free', 'weekly', 'monthly']).optional(),
    planExpiresAt: z.string().datetime({ offset: true }).nullable().optional(),
    status: z.enum(['active', 'throttled', 'banned']).optional(),
    dailyTokenCap: z.number().int().positive().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'empty patch' });

adminRouter.patch('/users/:id', async (req, res) => {
  const userId = String(req.params.id);
  if (!USER_ID_PATTERN.test(userId)) return res.status(400).json({ error: 'bad user id' });
  const parsed = patchUserSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad body' });
  const patch = parsed.data;

  try {
    const before = await loadUserDetail(userId);
    if (!before) return res.status(404).json({ error: 'user not found' });

    if (patch.plan !== undefined || patch.planExpiresAt !== undefined) {
      const { error } = await supabase.from('subscriptions').upsert({
        user_id: userId,
        plan: patch.plan ?? before.plan,
        expires_at: patch.planExpiresAt !== undefined ? patch.planExpiresAt : before.planExpiresAt,
        updated_at: nowIso(),
      });
      if (error) throw new Error(error.message);
    }
    if (patch.status !== undefined || patch.dailyTokenCap !== undefined) {
      const { error } = await supabase.from('user_limits').upsert({
        user_id: userId,
        status: patch.status ?? before.status,
        daily_token_cap: patch.dailyTokenCap !== undefined ? patch.dailyTokenCap : before.dailyTokenCap,
        updated_at: nowIso(),
      });
      if (error) throw new Error(error.message);
    }

    const after = await loadUserDetail(userId);
    audit(req.adminUser.id, 'update_user', {
      targetUserId: userId,
      detail: { before: { plan: before.plan, status: before.status, dailyTokenCap: before.dailyTokenCap }, after: { plan: after.plan, status: after.status, dailyTokenCap: after.dailyTokenCap } },
    });
    res.json(after);
  } catch (err) {
    console.error(`patch user failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update user.' });
  }
});

// ── Stats: users ─────────────────────────────────────────────────────
adminRouter.get('/stats/users', async (_req, res) => {
  try {
    const today = dayStartUtc();
    const weekAgo = daysAgoUtc(7);
    const [total, new7d, dayRows, weekRows, subs, busy] = await Promise.all([
      supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'admin'),
      supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('role', 'admin').gte('created_at', weekAgo.toISOString()),
      supabase.from('request_logs').select('user_id').gte('created_at', today.toISOString()).not('user_id', 'is', null),
      supabase.from('request_logs').select('user_id').gte('created_at', weekAgo.toISOString()).not('user_id', 'is', null),
      loadPlanMap(),
      supabase.from('profiles').select('id, tokens_used_today').gt('tokens_used_today', 0),
    ]);
    const firstErr = [total, new7d, dayRows, weekRows, busy].find((r) => r.error);
    if (firstErr) throw new Error(firstErr.error.message);

    // Users >80% of their effective daily cap (override first, then plan default).
    const busyIds = (busy.data ?? []).map((p) => p.id);
    const { data: caps, error: capErr } = busyIds.length
      ? await supabase.from('user_limits').select('user_id, daily_token_cap').in('user_id', busyIds)
      : { data: [], error: null };
    if (capErr) throw new Error(capErr.message);
    const capMap = new Map((caps ?? []).map((c) => [c.user_id, c.daily_token_cap]));
    const overQuota = (busy.data ?? []).filter((p) => {
      const limit = capMap.get(p.id) ?? dailyTokenLimit(subs.get(p.id)?.plan ?? 'free');
      return limit !== null && p.tokens_used_today >= limit * 0.8;
    }).length;

    const planCounts = new Map();
    for (const { plan } of subs.values()) planCounts.set(plan, (planCounts.get(plan) ?? 0) + 1);
    const paidCount = [...subs.values()].filter((v) => v.plan !== 'free').length;
    const planDistribution = [
      { plan: 'free', count: (total.count ?? 0) - paidCount },
      ...['weekly', 'monthly'].map((p) => ({ plan: p, count: planCounts.get(p) ?? 0 })),
    ];

    res.json({
      total: total.count ?? 0,
      new7d: new7d.count ?? 0,
      dau: new Set((dayRows.data ?? []).map((r) => r.user_id)).size,
      wau: new Set((weekRows.data ?? []).map((r) => r.user_id)).size,
      planDistribution,
      overQuota,
    });
  } catch (err) {
    console.error(`admin user stats failed: ${err.message}`);
    res.status(502).json({ error: 'User stats are unavailable.' });
  }
});

const USER_ID_PATTERN = /^[\w-]{36}$/;

const setUserStatus = async (res, userId, status, dailyTokenCap = null) => {
  const { error } = await supabase.from('user_limits').upsert({
    user_id: userId,
    status,
    daily_token_cap: dailyTokenCap,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
};

adminRouter.post('/users/:id/ban', async (req, res) => {
  const userId = String(req.params.id);
  if (!USER_ID_PATTERN.test(userId)) return res.status(400).json({ error: 'bad user id' });
  const banned = req.body?.banned !== false;
  try {
    await setUserStatus(res, userId, banned ? 'banned' : 'active', banned ? null : undefined);
    audit(req.adminUser.id, banned ? 'ban_user' : 'unban_user', { targetUserId: userId });
    res.json({ status: banned ? 'banned' : 'active' });
  } catch (err) {
    console.error(`ban failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update user status.' });
  }
});

adminRouter.post('/users/:id/throttle', async (req, res) => {
  const userId = String(req.params.id);
  if (!USER_ID_PATTERN.test(userId)) return res.status(400).json({ error: 'bad user id' });
  const cap = req.body?.dailyTokenCap;
  const lifted = cap == null; // null cap = back to plan defaults
  if (!lifted && (!Number.isInteger(cap) || cap <= 0)) {
    return res.status(400).json({ error: 'dailyTokenCap must be a positive integer or null' });
  }
  try {
    await setUserStatus(res, userId, lifted ? 'active' : 'throttled', lifted ? null : cap);
    audit(req.adminUser.id, lifted ? 'unthrottle_user' : 'throttle_user', {
      targetUserId: userId,
      detail: { dailyTokenCap: cap },
    });
    res.json({ status: lifted ? 'active' : 'throttled', dailyTokenCap: cap });
  } catch (err) {
    console.error(`throttle failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update throttle.' });
  }
});

adminRouter.post('/users/:id/reset-memory', async (req, res) => {
  const userId = String(req.params.id);
  if (!USER_ID_PATTERN.test(userId)) return res.status(400).json({ error: 'bad user id' });
  try {
    const [brain, items] = await Promise.all([
      supabase.from('user_brain').delete().eq('user_id', userId),
      supabase.from('memory_items').delete().eq('user_id', userId),
    ]);
    const firstErr = [brain, items].find((r) => r.error);
    if (firstErr) throw new Error(firstErr.error.message);
    audit(req.adminUser.id, 'reset_memory', { targetUserId: userId });
    res.json({ reset: true });
  } catch (err) {
    console.error(`reset memory failed: ${err.message}`);
    res.status(502).json({ error: 'Could not reset memory.' });
  }
});

// ── Coupons ──────────────────────────────────────────────────────────
adminRouter.get('/coupons', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('code, discount_pct, months, plan, max_redemptions, redeemed_count, expires_at, created_at')
      .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    res.json({ coupons: data ?? [] });
  } catch (err) {
    console.error(`coupons list failed: ${err.message}`);
    res.status(502).json({ error: 'Coupons are unavailable.' });
  }
});

const COUPON_GEN_PATTERN = /^[A-Z0-9][A-Z0-9-]{2,31}$/;

adminRouter.post('/coupons', async (req, res) => {
  const {
    code,
    count = 1,
    discountPct = 50,
    months = 3,
    plan = 'monthly',
    maxRedemptions = 1,
    expiresAt = '2026-12-31T23:59:59Z',
  } = req.body ?? {};
  const prefix = typeof code === 'string' && code ? code.toUpperCase() : 'PROMO';
  if (!COUPON_GEN_PATTERN.test(prefix)) {
    return res.status(400).json({ error: 'code must be 3-32 chars of A-Z, 0-9, dashes' });
  }
  if (!['weekly', 'monthly'].includes(plan)) {
    return res.status(400).json({ error: 'plan must be weekly or monthly' });
  }
  const qty = Math.min(Math.max(Number(count) || 1, 1), 50);
  const rows = Array.from({ length: qty }, (_, i) => ({
    code: qty === 1 && code ? prefix : `${prefix}-${String(i + 1).padStart(2, '0')}`,
    discount_pct: Number(discountPct) || 50,
    months: Number(months) || 3,
    plan,
    max_redemptions: Number(maxRedemptions) || 1,
    expires_at: expiresAt,
  }));
  try {
    const { data, error } = await supabase.from('coupons').insert(rows).select('code');
    if (error) throw new Error(error.message);
    audit(req.adminUser.id, 'create_coupon', { detail: { count: rows.length, prefix } });
    res.json({ created: (data ?? []).map((r) => r.code) });
  } catch (err) {
    console.error(`coupon create failed: ${err.message}`);
    res.status(502).json({ error: 'Could not create coupons.' });
  }
});

adminRouter.delete('/coupons/:code', async (req, res) => {
  const code = String(req.params.code).toUpperCase();
  try {
    const { error } = await supabase
      .from('coupons')
      .update({ expires_at: new Date().toISOString() })
      .eq('code', code);
    if (error) throw new Error(error.message);
    audit(req.adminUser.id, 'expire_coupon', { detail: { code } });
    res.json({ expired: code });
  } catch (err) {
    console.error(`coupon expire failed: ${err.message}`);
    res.status(502).json({ error: 'Could not expire the coupon.' });
  }
});

// ── Analytics ────────────────────────────────────────────────────────
adminRouter.get('/analytics', async (_req, res) => {
  try {
    const monthStart = new Date();
    monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('request_logs')
      .select('feature, intent_tag, rated, feedback_text, created_at')
      .gte('created_at', monthStart.toISOString());
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const featureCounts = {};
    const intentCounts = {};
    let thumbsUp = 0;
    let thumbsDown = 0;
    const feedback = [];
    for (const r of rows) {
      featureCounts[r.feature] = (featureCounts[r.feature] ?? 0) + 1;
      if (r.intent_tag) intentCounts[r.intent_tag] = (intentCounts[r.intent_tag] ?? 0) + 1;
      if (r.rated === 1) thumbsUp += 1;
      if (r.rated === -1) {
        thumbsDown += 1;
        if (r.feedback_text) {
          feedback.push({ text: r.feedback_text, at: r.created_at });
        }
      }
    }
    res.json({ featureCounts, intentCounts, thumbsUp, thumbsDown, feedback });
  } catch (err) {
    console.error(`analytics failed: ${err.message}`);
    res.status(502).json({ error: 'Analytics are unavailable.' });
  }
});

// ── System config + kill switch ──────────────────────────────────────
adminRouter.get('/config', async (_req, res) => {
  try {
    const { data, error } = await supabase.from('system_config').select('key, value, updated_at');
    if (error) throw new Error(error.message);
    res.json({ config: data ?? [] });
  } catch (err) {
    console.error(`config read failed: ${err.message}`);
    res.status(502).json({ error: 'Config is unavailable.' });
  }
});

const setFlag = async (key, value) => {
  const { error } = await supabase
    .from('system_config')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  flagCache.delete(key);
};

adminRouter.post('/kill-switch', async (req, res) => {
  const paused = req.body?.paused === true;
  try {
    await setFlag('llm_requests_paused', paused);
    audit(req.adminUser.id, 'kill_switch', { detail: { paused } });
    logger.warn(`admin ${req.adminUser.id.slice(0, 8)} ${paused ? 'PAUSED' : 'RESUMED'} LLM requests`);
    res.json({ paused });
  } catch (err) {
    console.error(`kill switch failed: ${err.message}`);
    res.status(502).json({ error: 'Could not toggle the kill switch.' });
  }
});

adminRouter.post('/circuit-breaker', async (req, res) => {
  const active = req.body?.active === true;
  try {
    await setFlag('circuit_breaker_active', active);
    audit(req.adminUser.id, 'circuit_breaker', { detail: { active } });
    res.json({ active });
  } catch (err) {
    console.error(`circuit breaker toggle failed: ${err.message}`);
    res.status(502).json({ error: 'Could not toggle the circuit breaker.' });
  }
});

// ── Audit + error feeds ──────────────────────────────────────────────
adminRouter.get('/audit', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('id, admin_id, action, target_user_id, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    res.json({ entries: data ?? [] });
  } catch (err) {
    console.error(`audit read failed: ${err.message}`);
    res.status(502).json({ error: 'Audit log is unavailable.' });
  }
});

adminRouter.get('/errors', async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('system_error_logs')
      .select('id, source, message, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    res.json({ entries: data ?? [] });
  } catch (err) {
    console.error(`error feed failed: ${err.message}`);
    res.status(502).json({ error: 'Error log is unavailable.' });
  }
});
