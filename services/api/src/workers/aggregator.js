// Aggregator: writes one `daily_summary` telemetry event per UTC day so the
// panel can chart historical burn without scanning request_logs forever.
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';

export const runAggregator = async () => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const todayKey = dayStart.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('request_logs')
    .select('user_id, feature, cost_usd, prompt_tokens, completion_tokens')
    .gte('created_at', dayStart.toISOString());
  if (error) throw new Error(`aggregator read failed: ${error.message}`);

  const rows = data ?? [];
  const users = new Set(rows.map((r) => r.user_id).filter(Boolean));
  const byFeature = {};
  let cost = 0;
  let tokens = 0;
  for (const r of rows) {
    byFeature[r.feature] = (byFeature[r.feature] ?? 0) + 1;
    cost += Number(r.cost_usd ?? 0);
    tokens += Number(r.prompt_tokens ?? 0) + Number(r.completion_tokens ?? 0);
  }

  // Upsert-like: one summary row per day (delete + insert keeps it idempotent).
  await supabase
    .from('telemetry_events')
    .delete()
    .eq('event', 'daily_summary')
    .gte('created_at', dayStart.toISOString());
  const { error: insErr } = await supabase.from('telemetry_events').insert({
    event: 'daily_summary',
    props: {
      day: todayKey,
      requests: rows.length,
      active_users: users.size,
      cost_usd: Number(cost.toFixed(6)),
      tokens,
      by_feature: byFeature,
    },
  });
  if (insErr) throw new Error(`aggregator write failed: ${insErr.message}`);
  logger.info(`aggregator: ${rows.length} requests, $${cost.toFixed(4)} today`);
};
