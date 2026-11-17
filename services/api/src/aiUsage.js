// Per-LLM-call spend ledger. Every attempt that reaches a provider writes one
// ai_usage row (fire-and-forget — telemetry must never block a user request).
// Cost comes from model_pricing; unpriced models keep cost_usd = null so the
// admin panel can flag them instead of silently pretending they are free.
import { supabase } from './supabase.js';
import { llmConfig } from './config.js';
import { logger } from './logger.js';

// ── Pricing (cached; refresh on demand) ──────────────────────────────
let pricingCache = new Map();
let pricingLoadedAt = 0;
const PRICING_TTL_MS = 5 * 60_000;

const loadPricing = async () => {
  if (pricingLoadedAt > Date.now() - PRICING_TTL_MS) return pricingCache;
  const { data, error } = await supabase.from('model_pricing').select('provider, model, input_per_1m, output_per_1m');
  if (error) {
    logger.warn(`model_pricing read failed: ${error.message}`);
    return pricingCache;
  }
  pricingCache = new Map((data ?? []).map((r) => [`${r.provider}:${r.model}`, r]));
  pricingLoadedAt = Date.now();
  return pricingCache;
};

const costFor = (row, promptTokens, completionTokens) =>
  (promptTokens * Number(row.input_per_1m) + completionTokens * Number(row.output_per_1m)) / 1e6;

// ── Budget alerts ────────────────────────────────────────────────────
// One alert per threshold transition per UTC day — crossing 80% logs once,
// crossing 100% logs once, not on every subsequent call.
const alertKey = (level, kind, provider) => `${level}:${kind}:${provider}`;

const raiseAlert = async (level, kind, message, provider, meta = {}) => {
  const { error } = await supabase
    .from('admin_alerts')
    .insert({ level, kind, message, provider, meta });
  if (error) logger.warn(`admin_alerts insert failed: ${error.message}`);
};

const todayStartUtc = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const monthStartUtc = () => {
  const n = new Date();
  return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), 1));
};

const sumSpend = async (provider, sinceIso) => {
  const { data, error } = await supabase
    .from('ai_usage')
    .select('cost_usd')
    .eq('provider', provider)
    .gte('ts', sinceIso)
    .limit(100000);
  if (error) {
    logger.warn(`ai_usage spend sum failed: ${error.message}`);
    return null;
  }
  return (data ?? []).reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
};

const alreadyRaisedToday = async (key) => {
  const [level, kind, provider] = key.split(':');
  const { data, error } = await supabase
    .from('admin_alerts')
    .select('id')
    .eq('level', level)
    .eq('kind', kind)
    .eq('provider', provider)
    .gte('created_at', todayStartUtc().toISOString())
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
};

// Optional emergency brake: OFF unless AI_BUDGET_KILL_SWITCH=true is set.
const KILL_SWITCH_ENABLED = process.env.AI_BUDGET_KILL_SWITCH === 'true';

const checkBudgets = async (provider) => {
  const { data: budget, error: bErr } = await supabase
    .from('ai_budgets')
    .select('daily_usd, monthly_usd, warn_pct, hard_cap_pct')
    .eq('provider', provider)
    .maybeSingle();
  if (bErr || !budget) return;

  const [daySpend, monthSpend] = await Promise.all([
    sumSpend(provider, todayStartUtc().toISOString()),
    sumSpend(provider, monthStartUtc().toISOString()),
  ]);
  if (daySpend === null || monthSpend === null) return;

  const checks = [
    { label: 'daily', spend: daySpend, capUsd: Number(budget.daily_usd) },
    { label: 'monthly', spend: monthSpend, capUsd: Number(budget.monthly_usd) },
  ];

  for (const c of checks) {
    if (c.capUsd <= 0) continue;
    const pct = (c.spend / c.capUsd) * 100;
    if (pct >= Number(budget.hard_cap_pct)) {
      const key = alertKey('critical', `budget_hard_${c.label}`, provider);
      if (!(await alreadyRaisedToday(key))) {
        await raiseAlert(
          'critical',
          `budget_hard_${c.label}`,
          `${provider} ${c.label} spend $${c.spend.toFixed(2)} hit ${Math.round(pct)}% of the $${c.capUsd} cap`,
          provider,
          { spend: c.spend, cap: c.capUsd, pct },
        );
        if (KILL_SWITCH_ENABLED && c.label === 'daily') {
          await supabase.from('system_config').upsert({ key: 'global_kill_switch', value: true });
          logger.warn('AI budget hard cap: global_kill_switch engaged');
        }
      }
    } else if (pct >= Number(budget.warn_pct)) {
      const key = alertKey('warning', `budget_warn_${c.label}`, provider);
      if (!(await alreadyRaisedToday(key))) {
        await raiseAlert(
          'warning',
          `budget_warn_${c.label}`,
          `${provider} ${c.label} spend $${c.spend.toFixed(2)} crossed ${Math.round(pct)}% of the $${c.capUsd} cap`,
          provider,
          { spend: c.spend, cap: c.capUsd, pct },
        );
      }
    }
  }
};

// ── Public API ───────────────────────────────────────────────────────
// One row per provider call. cost null + estimated flags are kept honest —
// never fake a number we don't actually have.
export const logLlmCall = ({
  provider = llmConfig.provider,
  model,
  feature = null,
  userId = null,
  promptTokens = 0,
  completionTokens = 0,
  latencyMs = null,
  success = true,
  errorCode = null,
  estimated = false,
}) => {
  void (async () => {
    try {
      const pricing = await loadPricing();
      const row = model ? pricing.get(`${provider}:${model}`) : null;
      // Failed calls count toward the ledger but cost nothing.
      const costUsd =
        success && row ? costFor(row, promptTokens, completionTokens) : success ? null : 0;

      const { error } = await supabase.from('ai_usage').insert({
        provider,
        model: model ?? null,
        feature,
        user_id: userId,
        prompt_tokens: Math.max(0, Math.round(promptTokens)),
        completion_tokens: Math.max(0, Math.round(completionTokens)),
        cost_usd: costUsd,
        latency_ms: latencyMs !== null ? Math.max(0, Math.round(latencyMs)) : null,
        success,
        error_code: errorCode,
        estimated,
      });
      if (error) {
        logger.warn(`ai_usage insert failed: ${error.message}`);
        return;
      }
      // Check budgets after every successful priced call — cheap enough at
      // current volume, and the alternative (a counter) drifts on restarts.
      if (success && costUsd !== null) void checkBudgets(provider);
    } catch (err) {
      logger.warn(`logLlmCall failed: ${err.message}`);
    }
  })();
};

// ── Provider balance sync (cross-check only, never the source of truth) ──
export const providerSync = {
  lastCheckedAt: null,
  lastOk: null,
  driftPct: null,
  error: null,
};

const syncOpenRouter = async () => {
  if (llmConfig.provider !== 'openrouter') return;
  const res = await fetch('https://openrouter.ai/api/v1/credits', {
    headers: { Authorization: `Bearer ${llmConfig.apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`credits endpoint returned ${res.status}`);
  const json = await res.json();
  const providerTotal = Number(json?.data?.total_usage ?? NaN);
  const loggedTotal = await sumSpend('openrouter', '1970-01-01T00:00:00Z');
  if (Number.isFinite(providerTotal) && loggedTotal !== null && providerTotal > 0) {
    providerSync.driftPct = ((providerTotal - loggedTotal) / providerTotal) * 100;
    if (Math.abs(providerSync.driftPct) > 5) {
      const key = alertKey('warning', 'provider_drift', 'openrouter');
      if (!(await alreadyRaisedToday(key))) {
        await raiseAlert(
          'warning',
          'provider_drift',
          `OpenRouter reports $${providerTotal.toFixed(2)} total usage but our ledger has $${loggedTotal.toFixed(2)} (${providerSync.driftPct.toFixed(1)}% drift)`,
          'openrouter',
          { providerTotal, loggedTotal, driftPct: providerSync.driftPct },
        );
      }
    }
  }
};

export const runProviderSync = async () => {
  providerSync.lastCheckedAt = new Date().toISOString();
  try {
    await syncOpenRouter();
    // Groq exposes no billing/usage API — there is literally nothing to sync.
    providerSync.lastOk = true;
    providerSync.error = null;
  } catch (err) {
    providerSync.lastOk = false;
    providerSync.error = err.message;
    logger.warn(`provider sync failed: ${err.message}`);
  }
};

const SYNC_INTERVAL_MS = 6 * 60 * 60_000;
export const startProviderSync = () => {
  void runProviderSync();
  setInterval(runProviderSync, SYNC_INTERVAL_MS).unref();
};
