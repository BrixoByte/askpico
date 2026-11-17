// Railway public GraphQL API client.
// Endpoint: https://backboard.railway.com/graphql/v2 (Bearer token).
// 8s timeout, up to 2 retries, and a short in-memory cache per query key so a
// 30s-refreshing admin page can't trip rate limits. Every public function
// returns null/[] on failure — callers decide what "stale" means.

import { logger } from './logger.js';

const ENDPOINT = 'https://backboard.railway.com/graphql/v2';
const TIMEOUT_MS = 8_000;
const MAX_RETRIES = 2;
const CACHE_TTL_MS = 25_000;

const token = process.env.RAILWAY_API_TOKEN || '';
const projectId = process.env.RAILWAY_PROJECT_ID || '';
const serviceId = process.env.RAILWAY_SERVICE_ID || '';
const environmentId = process.env.RAILWAY_ENVIRONMENT_ID || '';

export const railwayConfigured = Boolean(token && projectId && serviceId && environmentId);

const cache = new Map(); // key -> { data, at }
const cached = (key) => {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < CACHE_TTL_MS ? hit.data : undefined;
};

const gql = async (query, variables) => {
  if (!railwayConfigured) return null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: controller.signal,
      });
      if (res.status === 429 || res.status >= 500) throw new Error(`railway ${res.status}`);
      const body = await res.json();
      if (body.errors?.length) throw new Error(body.errors[0].message);
      return body.data;
    } catch (err) {
      if (attempt === MAX_RETRIES) {
        logger.warn(`railway gql failed after ${MAX_RETRIES + 1} tries: ${err.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
};

const ids = { projectId, serviceId, environmentId };

// Latest deployments (most recent first).
export const listDeployments = async (limit = 20) => {
  const key = `deployments:${limit}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  const data = await gql(
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: $first) {
        edges { node { id status createdAt updatedAt url meta } }
      }
    }`,
    { input: ids, first: limit },
  );
  const nodes = data?.deployments?.edges?.map((e) => e.node) ?? [];
  cache.set(key, nodes);
  return nodes;
};

export const latestDeployment = async () => (await listDeployments(1))[0] ?? null;

export const latestSuccessfulDeployment = async () => {
  const data = await gql(
    `query deployments($input: DeploymentListInput!, $first: Int) {
      deployments(input: $input, first: 1) {
        edges { node { id status createdAt url meta } }
      }
    }`,
    { input: { ...ids, status: { successfulOnly: true } }, first: 1 },
  );
  return data?.deployments?.edges?.[0]?.node ?? null;
};

// Service metrics — Railway exposes the `metrics` query with a measurements
// enum (CPU_USAGE, MEMORY_USAGE_GB, MEMORY_LIMIT_GB, NETWORK_RX_GB, …).
// Returns { measurement: [{ ts, value }] } or null.
export const serviceMetrics = async ({ startDate, endDate = null, sampleRateSeconds = 300 }) => {
  const key = `metrics:${startDate}:${sampleRateSeconds}`;
  const hit = cached(key);
  if (hit !== undefined) return hit;
  const data = await gql(
    `query metrics($measurements: [MetricMeasurement!]!, $projectId: String!, $environmentId: String!, $serviceId: String!, $startDate: DateTime!, $endDate: DateTime, $sampleRateSeconds: Int) {
      metrics(measurements: $measurements, projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId, startDate: $startDate, endDate: $endDate, sampleRateSeconds: $sampleRateSeconds) {
        measurement
        values { ts value }
      }
    }`,
    {
      measurements: ['CPU_USAGE', 'CPU_LIMIT', 'MEMORY_USAGE_GB', 'MEMORY_LIMIT_GB'],
      ...ids,
      startDate,
      endDate,
      sampleRateSeconds,
    },
  );
  const out = {};
  for (const m of data?.metrics ?? []) out[m.measurement] = m.values ?? [];
  const result = Object.keys(out).length ? out : null;
  if (result) cache.set(key, result);
  return result;
};
