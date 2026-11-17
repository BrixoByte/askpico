// Voice engine health routes — mounted at /api/admin/voice (after requireAdmin).
import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';
import { getFlag } from '../flags.js';
import { evaluateStatuses, runProbeNow } from '../voiceHealth.js';

export const voiceRouter = express.Router();

const audit = (adminId, action, detail) => {
  supabase
    .from('admin_audit_log')
    .insert({ admin_id: adminId, action, detail })
    .then(({ error }) => { if (error) logger.warn(`audit failed for "${action}": ${error.message}`); });
};

const RANGE_MS = { '1h': 3_600_000, '24h': 86_400_000, '7d': 7 * 86_400_000 };
const rangeSchema = z.enum(['1h', '24h', '7d']).default('24h');
const rangeStart = (r) => new Date(Date.now() - RANGE_MS[r]).toISOString();

// Probe button: at most one manual probe per engine per 30s, across admins.
const lastManualProbe = new Map();
const MANUAL_PROBE_COOLDOWN_MS = 30_000;

// Per-engine status + latency/success stats, plus real-traffic vs probe gap
// so the UI can show "probes say healthy but users see failures".
voiceRouter.get('/health', async (_req, res) => {
  try {
    const [engines, { data: traffic }, primary, voiceEnabled] = await Promise.all([
      evaluateStatuses(),
      supabase.from('tts_requests').select('engine_used, success, latency_ms')
        .gte('ts', new Date(Date.now() - 3_600_000).toISOString()),
      getFlag('tts_primary', null),
      getFlag('voice_enabled', true),
    ]);

    const trafficBy = {};
    for (const r of traffic ?? []) {
      const e = r.engine_used ?? 'none';
      const t = (trafficBy[e] ??= { total: 0, ok: 0 });
      t.total += 1;
      if (r.success) t.ok += 1;
    }
    for (const e of Object.keys(trafficBy)) {
      trafficBy[e].success1h = trafficBy[e].total ? trafficBy[e].ok / trafficBy[e].total : null;
    }

    res.json({
      engines,
      routing: { ttsPrimary: primary, voiceEnabled },
      realTraffic1h: trafficBy, // keyed by engine; 'none' = requests where every engine failed
      allDown: ['edge', 'laptop'].every((e) => engines[e] && ['down', 'offline'].includes(engines[e].status)),
    });
  } catch (err) {
    console.error(`voice health failed: ${err.message}`);
    res.status(502).json({ error: 'Voice health is unavailable.' });
  }
});

// Fallback frequency: how often the secondary engine (or nothing) served users.
voiceRouter.get('/fallbacks', async (req, res) => {
  const range = rangeSchema.safeParse(req.query.range ?? '24h');
  if (!range.success) return res.status(400).json({ error: 'range must be 1h | 24h | 7d' });
  try {
    const { data, error } = await supabase
      .from('tts_requests')
      .select('ts, fallback_reason, engine_used, success')
      .gte('ts', rangeStart(range.data))
      .order('ts', { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message);

    const byReason = {};
    const byDay = {};
    let fallbacks = 0;
    for (const r of data ?? []) {
      if (r.fallback_triggered || !r.success) fallbacks += 1;
      const reason = r.fallback_reason ?? (r.success ? null : 'all_failed');
      if (reason) byReason[reason] = (byReason[reason] ?? 0) + 1;
      const day = r.ts.slice(0, 10);
      const d = (byDay[day] ??= { total: 0, fallbacks: 0 });
      d.total += 1;
      if (r.fallback_triggered) d.fallbacks += 1;
    }
    res.json({
      range: range.data,
      total: data?.length ?? 0,
      fallbacks,
      byReason,
      byDay: Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day, ...v })),
    });
  } catch (err) {
    console.error(`voice fallbacks failed: ${err.message}`);
    res.status(502).json({ error: 'Fallback stats are unavailable.' });
  }
});

// Probe timeline: latency + ok over time per engine, for the latency chart.
voiceRouter.get('/timeline', async (req, res) => {
  const range = rangeSchema.safeParse(req.query.range ?? '24h');
  if (!range.success) return res.status(400).json({ error: 'range must be 1h | 24h | 7d' });
  try {
    const { data, error } = await supabase
      .from('tts_health_checks')
      .select('ts, engine, ok, latency_ms, error')
      .gte('ts', rangeStart(range.data))
      .order('ts', { ascending: true })
      .limit(2000);
    if (error) throw new Error(error.message);
    res.json({ range: range.data, points: data ?? [] });
  } catch (err) {
    console.error(`voice timeline failed: ${err.message}`);
    res.status(502).json({ error: 'Voice timeline is unavailable.' });
  }
});

// Recent failures list for the page.
voiceRouter.get('/failures', async (_req, res) => {
  try {
    const [{ data: probes }, { data: traffic }] = await Promise.all([
      supabase.from('tts_health_checks').select('ts, engine, error, latency_ms')
        .eq('ok', false).order('ts', { ascending: false }).limit(15),
      supabase.from('tts_requests').select('ts, engine_used, fallback_reason, latency_ms')
        .eq('success', false).order('ts', { ascending: false }).limit(15),
    ]);
    res.json({
      probes: (probes ?? []).map((p) => ({ ...p, kind: 'probe' })),
      traffic: (traffic ?? []).map((t) => ({ ...t, kind: 'traffic' })),
    });
  } catch (err) {
    console.error(`voice failures failed: ${err.message}`);
    res.status(502).json({ error: 'Failure list is unavailable.' });
  }
});

// Manual probe. Rate limited per engine; audited.
const probeSchema = z.enum(['edge', 'laptop']);
voiceRouter.post('/probe/:engine', async (req, res) => {
  const engine = probeSchema.safeParse(req.params.engine);
  if (!engine.success) return res.status(400).json({ error: 'engine must be edge | laptop' });

  const last = lastManualProbe.get(engine.data) ?? 0;
  if (Date.now() - last < MANUAL_PROBE_COOLDOWN_MS) {
    return res.status(429).json({
      error: `Probe already ran ${Math.round((Date.now() - last) / 1000)}s ago. Wait ${Math.ceil(MANUAL_PROBE_COOLDOWN_MS / 1000)}s.`,
    });
  }
  lastManualProbe.set(engine.data, Date.now());
  try {
    const result = await runProbeNow(engine.data);
    audit(req.adminUser.id, 'voice_probe', { engine: engine.data, ok: result.ok, latencyMs: result.latencyMs });
    res.json({ engine: engine.data, ...result });
  } catch (err) {
    console.error(`manual probe failed: ${err.message}`);
    res.status(502).json({ error: 'Probe failed to run.' });
  }
});
