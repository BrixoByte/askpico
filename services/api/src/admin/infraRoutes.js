// Infrastructure monitoring routes — mounted at /api/admin/infra (after requireAdmin).
// All routes are read-only and degrade gracefully: when the Railway API is
// unconfigured or down, they serve cached/local data flagged `stale: true`.
import express from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
import {
  latestDeployment,
  latestSuccessfulDeployment,
  listDeployments,
  railwayConfigured,
  serviceMetrics,
} from '../railway.js';
import { healthHistory, healthSnapshot } from '../localHealth.js';

export const infraRouter = express.Router();

// ── Health rules (config constants — adjust without touching logic) ─────────
export const RAM_WARN_PCT = 85;   // RAM over this % of limit => degraded
export const RAM_DOWN_PCT = 95;   // RAM over this % of limit => down
export const RESTART_DOWN_PER_H = 3; // this many crashed deploys in 1h => down

const RANGE_MS = {
  '1h': 3_600_000,
  '6h': 6 * 3_600_000,
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
};
const rangeSchema = z.enum(['1h', '6h', '24h', '7d']).default('24h');
const rangeStart = (r) => new Date(Date.now() - RANGE_MS[r]).toISOString();

const commitOf = (d) =>
  d?.meta?.commitMessage ?? d?.meta?.commit_message ?? d?.meta?.message ?? null;
const deployDto = (d) => ({
  id: d.id,
  status: d.status,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt ?? null,
  url: d.url ?? d.staticUrl ?? null,
  commit: commitOf(d),
  sha: d.meta?.commitHash?.slice(0, 7) ?? null,
  branch: d.meta?.branch ?? null,
});

// Latest deployment + computed health banner. Railway down/unconfigured →
// status 'unknown' with stale flag and local snapshot so the page still works.
infraRouter.get('/status', async (_req, res) => {
  const [latest, lastGood, restarts1h] = await Promise.all([
    latestDeployment(),
    latestSuccessfulDeployment(),
    restartCount(3_600_000),
  ]);
  const local = healthSnapshot();

  let status = 'unknown';
  if (latest) {
    const ramPct = null; // filled by /metrics — status uses deploy + restart rules only
    void ramPct;
    status = 'healthy';
    if (latest.status === 'FAILED' || latest.status === 'CRASHED') status = 'degraded';
    if (restarts1h >= RESTART_DOWN_PER_H) status = 'down';
    if (['BUILDING', 'DEPLOYING', 'QUEUED', 'WAITING'].includes(latest.status)) status = 'deploying';
  } else if (!railwayConfigured) {
    status = 'unconfigured';
  }

  res.json({
    configured: railwayConfigured,
    status,
    latestDeploy: latest ? deployDto(latest) : null,
    lastSuccessfulDeploy: lastGood ? deployDto(lastGood) : null,
    restarts1h,
    uptimeSec: local.uptimeSec,
    localMemRssMb: Math.round(local.memory.rss / 1024 / 1024),
    eventLoopLagMs: local.lagMs,
    stale: !latest, // no deploy data reached => Railway API or env is the problem
  });
});

// CPU % + RAM MB/limit over the range. Falls back to local process samples for
// RAM/lag so charts are never fully empty.
infraRouter.get('/metrics', async (req, res) => {
  const range = rangeSchema.safeParse(req.query.range ?? '24h');
  if (!range.success) return res.status(400).json({ error: 'range must be 1h | 6h | 24h | 7d' });
  const m = await serviceMetrics({
    startDate: rangeStart(range.data),
    sampleRateSeconds: range.data === '1h' ? 60 : range.data === '7d' ? 1800 : 300,
  });
  const cpu = m?.CPU_USAGE ?? [];
  const memGb = m?.MEMORY_USAGE_GB ?? [];
  const memLimitGb = m?.MEMORY_LIMIT_GB?.at(-1)?.value ?? null;
  const cpuLimit = m?.CPU_LIMIT?.at(-1)?.value ?? null;
  const latestMemMb = memGb.length ? Math.round(memGb.at(-1).value * 1024) : null;
  const memPct = latestMemMb !== null && memLimitGb
    ? Math.round((latestMemMb / (memLimitGb * 1024)) * 100) : null;

  let memHealth = 'unknown';
  if (memPct !== null) memHealth = memPct > RAM_DOWN_PCT ? 'down' : memPct > RAM_WARN_PCT ? 'degraded' : 'healthy';

  res.json({
    range: range.data,
    source: m ? 'railway' : 'local',
    stale: !m,
    cpu: cpu.map((p) => ({ ts: p.ts, percent: p.value })),
    ramMb: memGb.map((p) => ({ ts: p.ts, mb: Math.round(p.value * 1024) })),
    memLimitMb: memLimitGb !== null ? Math.round(memLimitGb * 1024) : null,
    cpuLimit,
    memHealth,
    local: healthHistory(rangeStart(range.data)),
  });
});

infraRouter.get('/deployments', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const nodes = await listDeployments(limit);
  res.json({ deployments: nodes.map(deployDto), stale: !nodes.length && railwayConfigured ? true : !railwayConfigured });
});

// Railway exposes no dedicated restarts list — a restart is inferred from a
// deployment that CRASHED or FAILED inside the range. Labelled `derived` so
// the UI can say so honestly.
const restartCount = async (rangeMs) => {
  const nodes = await listDeployments(50);
  const since = Date.now() - rangeMs;
  return nodes.filter(
    (d) => (d.status === 'CRASHED' || d.status === 'FAILED') && new Date(d.createdAt).getTime() >= since,
  ).length;
};

infraRouter.get('/restarts', async (req, res) => {
  const range = rangeSchema.safeParse(req.query.range ?? '24h');
  if (!range.success) return res.status(400).json({ error: 'range must be 1h | 6h | 24h | 7d' });
  const nodes = await listDeployments(50);
  const since = rangeStart(range.data);
  const events = nodes
    .filter((d) => (d.status === 'CRASHED' || d.status === 'FAILED') && d.createdAt >= since)
    .map(deployDto);
  res.json({
    range: range.data,
    derived: true, // inferred from CRASHED/FAILED deployments — no restarts API exists
    count: events.length,
    events,
    stale: !nodes.length,
  });
});

// Local /api/health samples — always available, no Railway dependency.
infraRouter.get('/local', (_req, res) => {
  res.json({ snapshot: healthSnapshot(), history: healthHistory() });
});
