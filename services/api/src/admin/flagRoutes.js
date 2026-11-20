// Feature flag admin routes — mounted at /api/admin/flags (after requireAdmin).
// Every write lands in flag_history AND admin_audit_log.
import express from 'express';
import { z } from 'zod';
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';
import { invalidateFlagCache } from '../flags.js';

export const flagRouter = express.Router();

const nowIso = () => new Date().toISOString();

const audit = (adminId, action, detail) => {
  supabase
    .from('admin_audit_log')
    .insert({ admin_id: adminId, action, detail })
    .then(({ error }) => { if (error) logger.warn(`audit failed for "${action}": ${error.message}`); });
};

// Value shape depends on the flag's declared type — one schema per type.
const valueFor = (type) =>
  type === 'boolean' ? z.boolean()
    : type === 'number' ? z.number()
    : type === 'string' ? z.string().min(1).max(200)
    : z.unknown();

const putSchema = z.object({
  value: z.unknown(),
  // Optimistic concurrency: client sends the updated_at it read; a stale write
  // (two admins editing) gets a 409 instead of silently clobbering.
  expectedUpdatedAt: z.string().datetime({ offset: true }),
  description: z.string().max(500).optional(),
});

const writeHistory = (key, oldValue, newValue, changedBy) =>
  supabase.from('flag_history').insert({ key, old_value: oldValue, new_value: newValue, changed_by: changedBy });

const KNOWN_MODEL_HINT = async () => {
  const { data } = await supabase.from('model_pricing').select('model');
  return new Set((data ?? []).map((r) => r.model));
};

flagRouter.get('/', async (_req, res) => {
  try {
    const [flags, history] = await Promise.all([
      supabase.from('feature_flags').select('*').order('key'),
      supabase.from('flag_history').select('key, changed_by, ts').order('ts', { ascending: false }).limit(200),
    ]);
    const firstErr = [flags, history].find((r) => r.error);
    if (firstErr) throw new Error(firstErr.error.message);

    // Last-change info per flag + who did it (profiles join for email).
    const lastByKey = new Map();
    for (const h of history.data ?? []) {
      if (!lastByKey.has(h.key)) lastByKey.set(h.key, h);
    }
    const actorIds = [...new Set([...lastByKey.values()].map((h) => h.changed_by).filter(Boolean))];
    const { data: actors } = actorIds.length
      ? await supabase.from('profiles').select('id, email').in('id', actorIds)
      : { data: [] };
    const emailMap = new Map((actors ?? []).map((a) => [a.id, a.email]));

    res.json({
      flags: (flags.data ?? []).map((f) => ({
        key: f.key,
        type: f.type,
        value: f.value,
        description: f.description,
        updatedAt: f.updated_at,
        lastChangedBy: lastByKey.get(f.key)?.changed_by
          ? emailMap.get(lastByKey.get(f.key).changed_by) ?? lastByKey.get(f.key).changed_by
          : null,
        lastChangedAt: lastByKey.get(f.key)?.ts ?? null,
      })),
    });
  } catch (err) {
    console.error(`flags list failed: ${err.message}`);
    res.status(502).json({ error: 'Flags are unavailable.' });
  }
});

flagRouter.put('/:key', async (req, res) => {
  const key = String(req.params.key);
  if (!/^[\w.]{1,80}$/.test(key)) return res.status(400).json({ error: 'bad flag key' });
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'bad body' });

  try {
    const { data: flag, error: fErr } = await supabase.from('feature_flags').select('*').eq('key', key).maybeSingle();
    if (fErr) throw new Error(fErr.message);
    if (!flag) return res.status(404).json({ error: 'flag not found' });

    const typed = valueFor(flag.type).safeParse(parsed.data.value);
    if (!typed.success) {
      return res.status(400).json({ error: `value must be a ${flag.type}` });
    }

    // Enum-style string flags get a closed set.
    const ENUMS = { ai_provider_primary: ['openrouter', 'groq', 'gemini'] };
    if (ENUMS[key] && !ENUMS[key].includes(typed.data)) {
      return res.status(400).json({ error: `${key} must be one of: ${ENUMS[key].join(', ')}` });
    }

    // model_routing: structure check + soft warning for unpriced/unknown models.
    let warnings = [];
    if (key === 'model_routing') {
      const v = typed.data;
      const ok =
        v && typeof v === 'object' && !Array.isArray(v) &&
        Object.values(v).every(
          (r) => r && typeof r === 'object' && typeof r.model === 'string' &&
            (r.fallbacks === undefined || (Array.isArray(r.fallbacks) && r.fallbacks.every((f) => typeof f === 'string'))),
        );
      if (!ok) return res.status(400).json({ error: 'model_routing must be {name: {model, fallbacks?[]}}' });
      const known = await KNOWN_MODEL_HINT();
      const referenced = Object.values(v).flatMap((r) => [r.model, ...(r.fallbacks ?? [])]);
      warnings = [...new Set(referenced.filter((m) => !known.has(m)))].map((m) => `model "${m}" has no model_pricing row`);
    }

    if (new Date(flag.updated_at).getTime() !== new Date(parsed.data.expectedUpdatedAt).getTime()) {
      return res.status(409).json({ error: 'Flag was changed by someone else. Reload and retry.', code: 'CONFLICT' });
    }

    const { error: uErr } = await supabase
      .from('feature_flags')
      .update({ value: typed.data, ...(parsed.data.description ? { description: parsed.data.description } : {}), updated_by: req.adminUser.id, updated_at: nowIso() })
      .eq('key', key)
      .eq('updated_at', flag.updated_at); // DB-level guard too — check-then-write race
    if (uErr) throw new Error(uErr.message);

    const { error: hErr } = await writeHistory(key, flag.value, typed.data, req.adminUser.id);
    if (hErr) logger.warn(`flag_history insert failed: ${hErr.message}`);
    audit(req.adminUser.id, 'update_flag', { key, before: flag.value, after: typed.data });
    invalidateFlagCache(key);
    res.json({ ok: true, warnings });
  } catch (err) {
    console.error(`flag update failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update flag.' });
  }
});

flagRouter.get('/history', async (req, res) => {
  const key = typeof req.query.key === 'string' ? req.query.key : null;
  const limit = Math.min(Number(req.query.limit) || 100, 300);
  try {
    let q = supabase
      .from('flag_history')
      .select('id, key, old_value, new_value, changed_by, ts')
      .order('ts', { ascending: false })
      .limit(limit);
    if (key) q = q.eq('key', key);
    const { data, error } = await q;
    if (error) throw new Error(error.message);

    const actorIds = [...new Set((data ?? []).map((h) => h.changed_by).filter(Boolean))];
    const { data: actors } = actorIds.length
      ? await supabase.from('profiles').select('id, email').in('id', actorIds)
      : { data: [] };
    const emailMap = new Map((actors ?? []).map((a) => [a.id, a.email]));
    res.json({
      history: (data ?? []).map((h) => ({
        ...h,
        changedByEmail: h.changed_by ? emailMap.get(h.changed_by) ?? h.changed_by : null,
      })),
    });
  } catch (err) {
    console.error(`flag history failed: ${err.message}`);
    res.status(502).json({ error: 'Flag history is unavailable.' });
  }
});

flagRouter.post('/:key/revert/:historyId', async (req, res) => {
  const key = String(req.params.key);
  const historyId = Number(req.params.historyId);
  if (!Number.isInteger(historyId)) return res.status(400).json({ error: 'bad history id' });
  try {
    const { data: entry, error: hErr } = await supabase
      .from('flag_history')
      .select('*')
      .eq('id', historyId)
      .eq('key', key)
      .maybeSingle();
    if (hErr) throw new Error(hErr.message);
    if (!entry) return res.status(404).json({ error: 'history entry not found' });
    // Revert = restore the value that was in place BEFORE this change.
    const restore = entry.old_value;
    if (restore === null || restore === undefined) {
      return res.status(400).json({ error: 'Nothing to revert to — this was the first value.' });
    }

    const { data: flag } = await supabase.from('feature_flags').select('value').eq('key', key).maybeSingle();
    const { error: uErr } = await supabase
      .from('feature_flags')
      .update({ value: restore, updated_by: req.adminUser.id, updated_at: nowIso() })
      .eq('key', key);
    if (uErr) throw new Error(uErr.message);

    await writeHistory(key, flag?.value ?? null, restore, req.adminUser.id);
    audit(req.adminUser.id, 'revert_flag', { key, revertedToHistoryId: historyId, restored: restore });
    invalidateFlagCache(key);
    res.json({ ok: true });
  } catch (err) {
    console.error(`flag revert failed: ${err.message}`);
    res.status(502).json({ error: 'Could not revert flag.' });
  }
});
