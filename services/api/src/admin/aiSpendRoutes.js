// AI spend admin routes — mounted at /api/admin/ai-spend + /api/admin/alerts.
// Ledger rows are written by logLlmCall() (src/aiUsage.js) at every provider call.
import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { providerSync } from '../aiUsage.js';
import { logger } from '../logger.js';

export const aiSpendRouter = express.Router();

const nowIso = () => new Date().toISOString();
const dayStartUtc = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };
const monthStartUtc = () => { const n = new Date(); return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1)); };
const daysAgoUtc = (days) => new Date(Date.now() - days * 86_400_000);

const audit = (adminId, action, detail) => {
  supabase
    .from('admin_audit_log')
    .insert({ admin_id: adminId, action, detail })
    .then(({ error }) => { if (error) logger.warn(`audit failed for "${action}": ${error.message}`); });
};

const spendRangeSchema = z.object({
  range: z.enum(['today', '7d', '30d']).default('30d'),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

const rangeSince = (range) => (range === 'today' ? dayStartUtc() : daysAgoUtc(range === '7d' ? 7 : 30));

// One bounded fetch, aggregate in JS — a few hundred rows at current volume.
const loadUsage = async (sinceDate) => {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('ts, provider, model, feature, user_id, prompt_tokens, completion_tokens, cost_usd, success, estimated')
    .gte('ts', sinceDate.toISOString())
    .order('ts', { ascending: true })
    .limit(100000);
  if (error) throw new Error(error.message);
  return data ?? [];
};

const sumUsd = (rows) => rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

aiSpendRouter.get('/summary', async (req, res) => {
  const parsed = spendRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad query' });
  const { range } = parsed.data;
  try {
    const rows = await loadUsage(rangeSince(range));
    const byDay = new Map();
    for (const r of rows) {
      const d = r.ts.slice(0, 10);
      byDay.set(d, (byDay.get(d) ?? 0) + Number(r.cost_usd ?? 0));
    }

    // Projected month-end: month-to-date spend scaled linearly by days elapsed.
    const monthStart = monthStartUtc();
    const monthRows = rows.filter((r) => r.ts >= monthStart.toISOString());
    const monthUsd = sumUsd(monthRows);
    const now = new Date();
    const daysInMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();
    const projected = now.getUTCDate() > 0 ? (monthUsd / now.getUTCDate()) * daysInMonth : monthUsd;

    const activeUsers = new Set(rows.filter((r) => r.user_id).map((r) => r.user_id)).size;
    const voiceRows = rows.filter((r) => r.feature === 'voice');

    // Honest metric: today's voice-tagged LLM spend ÷ today's voice seconds.
    // Historical voice minutes aren't stored, so only today is computable.
    const { data: voiceProfiles, error: vErr } = await supabase
      .from('profiles')
      .select('voice_seconds_used_today')
      .gt('voice_seconds_used_today', 0);
    if (vErr) throw new Error(vErr.message);
    const voiceSecondsToday = (voiceProfiles ?? []).reduce((s, p) => s + (p.voice_seconds_used_today ?? 0), 0);
    const todayIso = dayStartUtc().toISOString();
    const voiceUsdToday = rows
      .filter((r) => r.feature === 'voice' && r.ts >= todayIso)
      .reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);

    const unpricedModels = [
      ...new Set(rows.filter((r) => r.cost_usd === null && r.success && r.model).map((r) => r.model)),
    ];

    // Per-day × model matrix for the stacked chart: top 5 models, rest = 'other'.
    const modelTotals = new Map();
    for (const r of rows) modelTotals.set(r.model, (modelTotals.get(r.model) ?? 0) + Number(r.cost_usd ?? 0));
    const topModels = [...modelTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([m]) => m);
    const dayModel = new Map();
    for (const r of rows) {
      const d = r.ts.slice(0, 10);
      const key = topModels.includes(r.model) ? r.model : 'other';
      const row = dayModel.get(d) ?? {};
      row[key] = (row[key] ?? 0) + Number(r.cost_usd ?? 0);
      dayModel.set(d, row);
    }
    const dailyModels = [...dayModel.entries()].map(([date, m]) => ({ date, ...m }));

    res.json({
      range,
      totalUsd: sumUsd(rows),
      calls: rows.length,
      failedCalls: rows.filter((r) => !r.success).length,
      estimatedCalls: rows.filter((r) => r.estimated).length,
      promptTokens: rows.reduce((s, r) => s + r.prompt_tokens, 0),
      completionTokens: rows.reduce((s, r) => s + r.completion_tokens, 0),
      daily: [...byDay.entries()].map(([date, usd]) => ({ date, usd })),
      monthUsd,
      projectedMonthEndUsd: projected,
      activeUsers,
      costPerUserUsd: activeUsers > 0 ? sumUsd(rows) / activeUsers : 0,
      voiceMinutesToday: voiceSecondsToday / 60,
      costPerVoiceMinuteTodayUsd: voiceSecondsToday > 0 ? voiceUsdToday / (voiceSecondsToday / 60) : 0,
      voiceUsd: sumUsd(voiceRows),
      unpricedModels,
      modelKeys: [...topModels, 'other'],
      dailyModels,
    });
  } catch (err) {
    console.error(`ai-spend summary failed: ${err.message}`);
    res.status(502).json({ error: 'Spend summary is unavailable.' });
  }
});

aiSpendRouter.get('/by-model', async (req, res) => {
  const parsed = spendRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad query' });
  try {
    const rows = await loadUsage(rangeSince(parsed.data.range));
    const map = new Map();
    for (const r of rows) {
      const key = `${r.provider}:${r.model ?? 'unknown'}`;
      const m = map.get(key) ?? { model: r.model ?? 'unknown', provider: r.provider, usd: 0, calls: 0, tokens: 0, priced: true };
      m.usd += Number(r.cost_usd ?? 0);
      m.calls += 1;
      m.tokens += r.prompt_tokens + r.completion_tokens;
      if (r.cost_usd === null && r.success) m.priced = false;
      map.set(key, m);
    }
    res.json({ models: [...map.values()].sort((a, b) => b.usd - a.usd) });
  } catch (err) {
    console.error(`ai-spend by-model failed: ${err.message}`);
    res.status(502).json({ error: 'Model breakdown is unavailable.' });
  }
});

aiSpendRouter.get('/by-feature', async (req, res) => {
  const parsed = spendRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad query' });
  try {
    const rows = await loadUsage(rangeSince(parsed.data.range));
    const map = new Map();
    for (const r of rows) {
      const key = r.feature ?? 'unknown';
      const m = map.get(key) ?? { feature: key, usd: 0, calls: 0 };
      m.usd += Number(r.cost_usd ?? 0);
      m.calls += 1;
      map.set(key, m);
    }
    res.json({ features: [...map.values()].sort((a, b) => b.usd - a.usd) });
  } catch (err) {
    console.error(`ai-spend by-feature failed: ${err.message}`);
    res.status(502).json({ error: 'Feature breakdown is unavailable.' });
  }
});

aiSpendRouter.get('/top-users', async (req, res) => {
  const parsed = spendRangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad query' });
  try {
    const rows = await loadUsage(rangeSince(parsed.data.range));
    const map = new Map();
    for (const r of rows) {
      if (!r.user_id) continue;
      const m = map.get(r.user_id) ?? { userId: r.user_id, usd: 0, calls: 0, tokens: 0 };
      m.usd += Number(r.cost_usd ?? 0);
      m.calls += 1;
      m.tokens += r.prompt_tokens + r.completion_tokens;
      map.set(r.user_id, m);
    }
    const top = [...map.values()].sort((a, b) => b.usd - a.usd).slice(0, parsed.data.limit);
    const { data: profiles, error: pErr } = top.length
      ? await supabase.from('profiles').select('id, email, name').in('id', top.map((t) => t.userId))
      : { data: [], error: null };
    if (pErr) throw new Error(pErr.message);
    const pMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    res.json({
      users: top.map((t) => ({ ...t, email: pMap.get(t.userId)?.email ?? null, name: pMap.get(t.userId)?.name ?? null })),
    });
  } catch (err) {
    console.error(`ai-spend top-users failed: ${err.message}`);
    res.status(502).json({ error: 'Top spenders are unavailable.' });
  }
});

aiSpendRouter.get('/budgets', async (_req, res) => {
  try {
    const { data: budgets, error } = await supabase.from('ai_budgets').select('*').order('provider');
    if (error) throw new Error(error.message);
    const { data: spend, error: sErr } = await supabase
      .from('ai_usage')
      .select('provider, ts, cost_usd')
      .gte('ts', monthStartUtc().toISOString())
      .limit(100000);
    if (sErr) throw new Error(sErr.message);
    const todayIso = dayStartUtc().toISOString();
    const dayMap = new Map();
    const monthMap = new Map();
    for (const r of spend ?? []) {
      monthMap.set(r.provider, (monthMap.get(r.provider) ?? 0) + Number(r.cost_usd ?? 0));
      if (r.ts >= todayIso) dayMap.set(r.provider, (dayMap.get(r.provider) ?? 0) + Number(r.cost_usd ?? 0));
    }
    res.json({
      budgets: (budgets ?? []).map((b) => ({
        provider: b.provider,
        dailyUsd: Number(b.daily_usd),
        monthlyUsd: Number(b.monthly_usd),
        warnPct: b.warn_pct,
        hardCapPct: b.hard_cap_pct,
        spentTodayUsd: dayMap.get(b.provider) ?? 0,
        spentMonthUsd: monthMap.get(b.provider) ?? 0,
        updatedAt: b.updated_at,
      })),
    });
  } catch (err) {
    console.error(`ai-spend budgets failed: ${err.message}`);
    res.status(502).json({ error: 'Budgets are unavailable.' });
  }
});

const budgetPutSchema = z.object({
  provider: z.string().min(1).max(40),
  dailyUsd: z.number().positive().optional(),
  monthlyUsd: z.number().positive().optional(),
  warnPct: z.number().int().min(1).max(100).optional(),
  hardCapPct: z.number().int().min(1).max(200).optional(),
});

aiSpendRouter.put('/budgets', async (req, res) => {
  const parsed = budgetPutSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad body' });
  const { provider, dailyUsd, monthlyUsd, warnPct, hardCapPct } = parsed.data;
  try {
    const { data: before } = await supabase.from('ai_budgets').select('*').eq('provider', provider).maybeSingle();
    const merged = {
      provider,
      daily_usd: dailyUsd ?? Number(before?.daily_usd ?? 8),
      monthly_usd: monthlyUsd ?? Number(before?.monthly_usd ?? 250),
      warn_pct: warnPct ?? before?.warn_pct ?? 80,
      hard_cap_pct: hardCapPct ?? before?.hard_cap_pct ?? 100,
      updated_at: nowIso(),
    };
    if (merged.hard_cap_pct < merged.warn_pct) {
      return res.status(400).json({ error: 'hardCapPct must be >= warnPct' });
    }
    const { error } = await supabase.from('ai_budgets').upsert(merged);
    if (error) throw new Error(error.message);
    audit(req.adminUser.id, 'update_ai_budget', { before: before ?? null, after: merged });
    res.json({ ok: true, budget: merged });
  } catch (err) {
    console.error(`budget update failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update budget.' });
  }
});

// Last provider sync result — the UI shows a stale badge when it's old/failed.
aiSpendRouter.get('/provider-sync', (_req, res) => {
  res.json(providerSync);
});

// ── Alerts feed (mounted at /api/admin/alerts) ───────────────────────
export const alertsHandler = async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  try {
    const { data, error } = await supabase
      .from('admin_alerts')
      .select('id, level, kind, message, provider, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(error.message);
    res.json({ alerts: data ?? [] });
  } catch (err) {
    console.error(`alerts failed: ${err.message}`);
    res.status(502).json({ error: 'Alerts are unavailable.' });
  }
};
