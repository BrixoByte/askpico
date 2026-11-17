// Live feature flags — reads feature_flags with a short in-memory TTL so the
// panel's changes apply without a redeploy. A flag lookup must NEVER crash a
// user request: on any Supabase failure the cached or caller-supplied default
// is returned instead.
import { supabase } from './supabase.js';
import { logger } from './logger.js';

const FLAG_TTL_MS = 15_000;
const cache = new Map(); // key -> { value, at }

export const getFlag = async (key, defaultValue = null) => {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < FLAG_TTL_MS) return hit.value;
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error) throw error;
    const value = data ? data.value : defaultValue;
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch (err) {
    logger.warn(`flag lookup "${key}" failed, using default: ${err.message}`);
    return hit ? hit.value : defaultValue; // stale cache beats nothing
  }
};

export const getBoolFlag = async (key, defaultValue = false) =>
  (await getFlag(key, defaultValue)) === true;

export const invalidateFlagCache = (key = null) => {
  if (key === null) cache.clear();
  else cache.delete(key);
};

// Global kill switch / maintenance mode. Exempts admin + health so the panel
// itself can always reach the backend to turn the flags back off.
// Admin, health, and the machine heartbeat stay reachable during a kill or
// maintenance window — monitoring must keep working while users are blocked.
const EXEMPT = /^\/api\/(admin|health)(\/|$)|^\/api\/tts\/heartbeat$/;
export const flagMiddleware = async (req, res, next) => {
  if (EXEMPT.test(req.path)) return next();
  try {
    if (await getBoolFlag('global_kill_switch')) {
      return res.status(503).json({ error: 'Pico is temporarily paused by an administrator. Try again shortly.' });
    }
    if (await getBoolFlag('maintenance_mode')) {
      return res.status(503).json({ error: 'Pico is down for scheduled maintenance. Back soon.' });
    }
  } catch {
    // Fail open — a flag outage must not take the app down with it.
  }
  next();
};
