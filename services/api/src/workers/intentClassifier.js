// Cheap heuristic intent tagging done at request time — request text is
// never stored, so there is nothing for a batch job to classify later.
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';

const CODE_RE =
  /(```|\bfunction\b|\bconst\b|\blet\b|\bvar\b|\bimport\b|\bfrom\b|\bclass\b|\bdef\b|\breturn\b|stack ?trace|traceback|typescript|javascript|python|\bjava\b|\bsql\b|\bregex\b|compile|npm |pip |docker|kubernetes|\bapi\b|\bjson\b|\bhtml\b|\bcss\b)/i;
const URL_RE = /https?:\/\//gi;
// Same chunk of >= 10 chars repeated 4+ times = prompt-injection / stress payload.
const REPETITIVE_RE = /(.{10,})\1{3,}/s;
const JAILBREAK_RE = /(ignore (all |any |the )?(previous|prior|above) (instructions?|prompts?|rules?)|jailbreak|DAN mode|developer mode enabled)/i;

export const classifyIntent = (text) => {
  if (typeof text !== 'string') return null;
  const t = text.trim();
  if (t.length === 0) return null;
  if (t.length > 8000 || REPETITIVE_RE.test(t) || JAILBREAK_RE.test(t)) return 'stress_test';
  const urls = (t.match(URL_RE) ?? []).length;
  if (urls >= 3) return 'spam';
  if (CODE_RE.test(t)) return 'coding';
  return 'casual';
};

// Periodic sweep: users with >= ABUSE_THRESHOLD abusive tags today get
// user_limits.flagged = true so the panel's "flagged" filter can find them.
const ABUSE_THRESHOLD = 5;
const ABUSE_TAGS = ['spam', 'stress_test'];

export const sweepAbusiveUsers = async () => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('request_logs')
    .select('user_id, intent_tag')
    .gte('created_at', dayStart.toISOString())
    .in('intent_tag', ABUSE_TAGS)
    .not('user_id', 'is', null);
  if (error) throw new Error(`abuse sweep read failed: ${error.message}`);

  const counts = new Map();
  for (const row of data ?? []) counts.set(row.user_id, (counts.get(row.user_id) ?? 0) + 1);
  const offenders = [...counts.entries()].filter(([, n]) => n >= ABUSE_THRESHOLD);

  for (const [userId, n] of offenders) {
    const { error: upErr } = await supabase.from('user_limits').upsert({
      user_id: userId,
      flagged: true,
      flag_reason: `${n} abusive requests today (spam/stress_test)`,
      updated_at: new Date().toISOString(),
    });
    if (upErr) logger.warn(`flag upsert failed for ${userId}: ${upErr.message}`);
  }
  if (offenders.length > 0) logger.info(`classifier sweep flagged ${offenders.length} user(s)`);
};
