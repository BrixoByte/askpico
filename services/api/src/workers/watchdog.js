// Watchdog: periodic safety net that runs even when no traffic flows.
// - Re-checks the daily budget and trips circuit_breaker_active as a
//   backstop to the inline check inside log_request().
// - Records a warning telemetry event when error volume spikes.
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';

const ERROR_SPIKE_THRESHOLD = 50; // system errors per day before we complain

export const runWatchdog = async () => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayIso = dayStart.toISOString();

  const [spend, flags, errors] = await Promise.all([
    supabase.from('request_logs').select('cost_usd').gte('created_at', dayIso),
    supabase.from('system_config').select('key, value').in('key', [
      'daily_budget_usd',
      'circuit_breaker_active',
      'llm_requests_paused',
    ]),
    supabase
      .from('system_error_logs')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dayIso),
  ]);

  const firstErr = [spend, flags, errors].find((r) => r.error);
  if (firstErr) throw new Error(`watchdog read failed: ${firstErr.error.message}`);

  const flagMap = new Map((flags.data ?? []).map((r) => [r.key, r.value === true || r.value === 'true']));
  const budget = Number(
    (flags.data ?? []).find((r) => r.key === 'daily_budget_usd')?.value ?? 0
  );
  const spentToday = (spend.data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);

  // Backstop: if spend crossed the budget while the flag is still clear.
  if (budget > 0 && spentToday >= budget && flagMap.get('circuit_breaker_active') !== true) {
    const { error } = await supabase
      .from('system_config')
      .update({ value: 'true', updated_at: new Date().toISOString() })
      .eq('key', 'circuit_breaker_active');
    if (error) throw new Error(`circuit breaker update failed: ${error.message}`);
    logger.warn(`watchdog tripped circuit breaker: $${spentToday.toFixed(2)} >= $${budget}`);
  }

  const errorCount = errors.count ?? 0;
  if (errorCount >= ERROR_SPIKE_THRESHOLD) {
    await supabase.from('telemetry_events').insert({
      event: 'watchdog_error_spike',
      props: { errors_today: errorCount, threshold: ERROR_SPIKE_THRESHOLD },
    });
    logger.warn(`watchdog: ${errorCount} system errors today (threshold ${ERROR_SPIKE_THRESHOLD})`);
  }
};
