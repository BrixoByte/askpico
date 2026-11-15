import { logger } from '../logger.js';
import { embedText } from './vectorWorker.js';

// Lazy: importing this module in tests must not require SUPABASE_* env vars.
const getSupabase = async () => (await import('../supabase.js')).supabase;

const RECALL_THRESHOLD = Number(process.env.RECALL_THRESHOLD) || 0.78;
const RECALL_COUNT = Number(process.env.RECALL_COUNT) || 2;

// Only queries that reference past chats or earlier decisions trigger a
// vector search; ordinary questions never pay the embedding cost.
const RECALL_CUES =
  /\b(pehle|pahle|pichli|pichhli|pichle|doosri|dusri|dosri|wala chat|wale chat|puraani|purani|previous|earlier|before|last time|other chat|another chat|past chat|different chat|we discussed|we talked|did we|you remember|remember|recall|decide kiya|decided|discuss kiya|discussed|bataiya tha|btaya tha)\b/i;

export const shouldRecall = (query) =>
  typeof query === 'string' && query.trim() !== '' && RECALL_CUES.test(query);

// Returns up to `count` memory items whose cosine similarity clears the
// threshold, ordered best-first. Throws on embedding or RPC failure;
// callers should use recallContextSafe.
export const recallContext = async ({
  userId,
  query,
  threshold = RECALL_THRESHOLD,
  count = RECALL_COUNT,
  signal,
}) => {
  if (!shouldRecall(query)) return [];
  const embedding = await embedText(query, signal);
  const { data, error } = await (await getSupabase()).rpc('match_memory_items', {
    p_user_id: userId,
    p_query: `[${embedding.join(',')}]`,
    p_threshold: threshold,
    p_count: count,
  });
  if (error) throw new Error(`match_memory_items failed: ${error.message}`);
  return Array.isArray(data) ? data : [];
};

export const formatRetrievedContext = (matches) => {
  if (!Array.isArray(matches) || matches.length === 0) return '';
  const lines = matches.map((m) => {
    const date = m?.created_at ? String(m.created_at).slice(0, 10) : '';
    const sim = typeof m?.similarity === 'number' ? ` (match ${(m.similarity * 100).toFixed(0)}%)` : '';
    const content = typeof m?.content === 'string' ? m.content : '';
    return `Source: thread "${m?.chat_id ?? 'unknown'}"${date ? `, ${date}` : ''}${sim} — "${content}"`;
  });
  return `[RETRIEVED CONTEXT]\n${lines.join('\n')}`;
};

// Never lets recall break a request — a failed search just means no block.
export const recallContextSafe = async (args) => {
  try {
    return await recallContext(args);
  } catch (err) {
    logger.warn(`vector recall failed: ${err.message}`);
    return [];
  }
};
