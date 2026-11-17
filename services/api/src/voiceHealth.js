// Voice engine health — synthetic probes, status rules, and the real-traffic
// ledger. Circular import note: tts.js imports recordTtsRequest from here and
// this file imports probeEngine from tts.js; both are called long after module
// init, so the cycle is safe.

import { supabase } from './supabase.js';
import { logger } from './logger.js';
import { getFlag } from './flags.js';
import { probeEngine, probeableEngines } from './tts.js';

// ── Rules (config constants — tweak behavior without code edits) ────────────

export const PROBE_INTERVAL_MS = 90_000;   // synthetic probe every ~1.5 min
export const DOWN_STREAK = 3;              // consecutive failed probes => down
export const DEGRADED_P95_MS = 4_000;      // p95 over this => degraded
export const DEGRADED_SUCCESS_RATE = 0.95; // 1h probe success below => degraded
export const FLAP_DEBOUNCE = 2;            // same status twice before switching
export const HEARTBEAT_STALE_MS = 90_000;  // laptop silent longer => offline

const PROBABLE = ['edge', 'laptop'];       // 'fallback' is client-side, not probeable

// ── Real traffic ledger ─────────────────────────────────────────────────────

// Fire-and-forget; a logging failure must never affect the TTS response.
export const recordTtsRequest = ({ engineUsed, fallbackTriggered, fallbackReason, latencyMs, success, userId }) => {
  supabase
    .from('tts_requests')
    .insert({
      engine_used: engineUsed,
      fallback_triggered: fallbackTriggered,
      fallback_reason: fallbackReason,
      latency_ms: latencyMs,
      success,
      user_id: userId,
    })
    .then(({ error }) => {
      if (error) logger.warn(`tts_requests insert failed: ${error.message}`);
    });
};

export const recordHealthCheck = async (engine, probe) => {
  const { error } = await supabase.from('tts_health_checks').insert({
    engine,
    ok: probe.ok,
    latency_ms: probe.latencyMs,
    error: probe.error,
    audio_bytes: probe.bytes,
  });
  if (error) logger.warn(`tts_health_checks insert failed: ${error.message}`);
};

// ── Synthetic probes ────────────────────────────────────────────────────────

// One pass over every probeable engine. An engine disabled by the
// tts_primary/voice_enabled flags is skipped rather than probed — probing a
// disabled engine would only produce misleading failures.
export const runProbesOnce = async () => {
  if ((await getFlag('voice_enabled', true)) === false) return [];
  const results = [];
  for (const engine of probeableEngines()) {
    const probe = await probeEngine(engine);
    await recordHealthCheck(engine, probe);
    results.push({ engine, ...probe });
  }
  return results;
};

export const runProbeNow = async (engine) => {
  const probe = await probeEngine(engine);
  await recordHealthCheck(engine, probe);
  return probe;
};

export const startVoiceProbes = () => {
  const tick = () => runProbesOnce().catch((err) => logger.warn(`voice probes failed: ${err.message}`));
  tick();
  setInterval(tick, PROBE_INTERVAL_MS).unref();
};

// ── Laptop heartbeat ────────────────────────────────────────────────────────

export const recordHeartbeat = async (meta) =>
  supabase
    .from('laptop_heartbeat')
    .upsert({ id: 1, last_seen: new Date().toISOString(), meta: meta ?? {} })
    .then(({ error }) => {
      if (error) logger.warn(`laptop_heartbeat upsert failed: ${error.message}`);
      return !error;
    });

export const laptopHeartbeatAge = async () => {
  const { data, error } = await supabase.from('laptop_heartbeat').select('last_seen, meta').eq('id', 1).maybeSingle();
  if (error || !data) return { ageMs: null, meta: null };
  return { ageMs: Date.now() - new Date(data.last_seen).getTime(), meta: data.meta };
};

// ── Status evaluation ───────────────────────────────────────────────────────

const percentile = (sortedNums, p) => {
  if (!sortedNums.length) return null;
  const i = Math.min(sortedNums.length - 1, Math.ceil((p / 100) * sortedNums.length) - 1);
  return sortedNums[i];
};

const successRate = (rows) => (rows.length ? rows.filter((r) => r.ok).length / rows.length : null);

// Debounce: a new candidate status must be computed FLAP_DEBOUNCE evaluations
// in a row before it replaces the last reported one. Kills 1-probe flapping.
const reported = new Map(); // engine -> status
const candidate = new Map(); // engine -> { status, count }
const debounce = (engine, status) => {
  const prev = reported.get(engine);
  if (prev === status) {
    candidate.delete(engine);
    return status;
  }
  const c = candidate.get(engine);
  if (c && c.status === status) c.count += 1;
  else candidate.set(engine, { status, count: 1 });
  if (candidate.get(engine).count >= FLAP_DEBOUNCE) {
    reported.set(engine, status);
    candidate.delete(engine);
    return status;
  }
  return prev ?? status; // nothing reported yet: show it as-is
};

// Computes the current status per engine from tts_health_checks (+ heartbeat
// for laptop). Returns a map keyed by engine name.
export const evaluateStatuses = async () => {
  const out = {};
  const since1h = new Date(Date.now() - 3_600_000).toISOString();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  for (const engine of PROBABLE) {
    const [{ data: recent }, { data: last1h }, { data: last24h }] = await Promise.all([
      supabase.from('tts_health_checks').select('ts, ok, latency_ms, error')
        .eq('engine', engine).order('ts', { ascending: false }).limit(DOWN_STREAK),
      supabase.from('tts_health_checks').select('ok, latency_ms')
        .eq('engine', engine).gte('ts', since1h),
      supabase.from('tts_health_checks').select('ok')
        .eq('engine', engine).gte('ts', since24h),
    ]);

    const rows = recent ?? [];
    const downStreak = rows.length >= DOWN_STREAK && rows.every((r) => !r.ok);
    const lat1h = (last1h ?? []).map((r) => r.latency_ms).filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
    const sr1h = successRate(last1h ?? []);
    const sr24h = successRate(last24h ?? []);

    let status = 'healthy';
    if (rows.length > 0 && downStreak) status = 'down';
    else if ((lat1h.length && percentile(lat1h, 95) > DEGRADED_P95_MS) ||
             (sr1h !== null && sr1h < DEGRADED_SUCCESS_RATE)) status = 'degraded';
    if (!rows.length) status = 'offline'; // never probed (engine disabled/unconfigured)

    // Laptop only: a stale heartbeat forces 'offline' regardless of probes —
    // the machine is asleep or its tunnel dropped.
    let heartbeatAgeMs = null;
    if (engine === 'laptop') {
      const hb = await laptopHeartbeatAge();
      heartbeatAgeMs = hb.ageMs;
      if (hb.ageMs === null || hb.ageMs > HEARTBEAT_STALE_MS) status = 'offline';
    }

    out[engine] = {
      status: debounce(engine, status),
      lastCheck: rows[0]?.ts ?? null,
      lastError: rows.find((r) => !r.ok)?.error ?? null,
      downStreak,
      p50: percentile(lat1h, 50),
      p95: percentile(lat1h, 95),
      success1h: sr1h,
      success24h: sr24h,
      heartbeatAgeMs,
    };
  }

  // Browser fallback engine: lives client-side, can't be probed. Reported as
  // a static entry so the UI can show "always there" without faking numbers.
  out.fallback = {
    status: 'healthy',
    clientSide: true,
    lastCheck: null,
    lastError: null,
    p50: null,
    p95: null,
    success1h: null,
    success24h: null,
    heartbeatAgeMs: null,
  };
  return out;
};
