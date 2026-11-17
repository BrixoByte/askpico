// Local process health sampler — the honest fallback when the Railway API is
// down or unconfigured. Samples once a minute into a 24h ring buffer so the
// admin panel can still chart CPU-ish memory/lag history.

const SAMPLE_MS = 60_000;
const MAX_SAMPLES = 1440; // 24h of one-minute samples

const samples = []; // { ts, uptimeSec, rssMb, heapMb, lagMs }
let started = false;
let lastTick = process.hrtime.bigint();

const takeSample = () => {
  const now = process.hrtime.bigint();
  // Event-loop lag: how much later than the expected interval this tick ran.
  const lagMs = Math.max(0, Number(now - lastTick) / 1e6 - SAMPLE_MS);
  lastTick = now;
  const mem = process.memoryUsage();
  samples.push({
    ts: new Date().toISOString(),
    uptimeSec: Math.round(process.uptime()),
    rssMb: Math.round(mem.rss / 1024 / 1024),
    heapMb: Math.round(mem.heapUsed / 1024 / 1024),
    lagMs: Math.round(lagMs),
  });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
};

export const startLocalHealthSampling = () => {
  if (started) return;
  started = true;
  takeSample();
  setInterval(takeSample, SAMPLE_MS).unref();
};

export const healthSnapshot = () => ({
  ts: new Date().toISOString(),
  uptimeSec: Math.round(process.uptime()),
  memory: process.memoryUsage(),
  lagMs: samples.at(-1)?.lagMs ?? 0,
  sampleCount: samples.length,
});

export const healthHistory = (sinceIso = null) =>
  sinceIso ? samples.filter((s) => s.ts >= sinceIso) : [...samples];
