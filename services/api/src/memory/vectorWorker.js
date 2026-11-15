import { llmConfig } from '../config.js';
import { logger } from '../logger.js';

// Lazy: keeps this module importable without SUPABASE_* env vars (tests).
const getSupabase = async () => (await import('../supabase.js')).supabase;

// Embeddings go through the configured LLM provider's OpenAI-compatible
// /embeddings endpoint (OpenRouter serves openai/text-embedding-3-small).
const EMBED_MODEL = process.env.EMBED_MODEL || 'openai/text-embedding-3-small';
const EMBED_TIMEOUT_MS = Number(process.env.EMBED_TIMEOUT_MS) || 15000;
const CHUNK_MAX_CHARS = 900;

export const embedText = async (text, signal) => {
  if (process.env.EMBEDDINGS_ENABLED === 'false') throw new Error('embeddings disabled');
  if (!llmConfig.apiKey) throw new Error(`${llmConfig.keyName} is not set`);
  const res = await fetch(`${llmConfig.baseUrl}/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: String(text).slice(0, 4000) }),
    signal: signal ?? AbortSignal.timeout(EMBED_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`embed failed (${res.status})`);
  const data = await res.json();
  const vector = data?.data?.[0]?.embedding;
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('embeddings response contained no vector');
  }
  return vector;
};

// Indexes one completed turn (user message + assistant reply) as a single
// memory item. Called fire-and-forget after a turn finishes.
export const indexTurnMemory = async ({ userId, chatId, userText, assistantText }) => {
  const user = typeof userText === 'string' ? userText.trim() : '';
  const pico = typeof assistantText === 'string' ? assistantText.trim() : '';
  if (!userId || typeof chatId !== 'string' || chatId === '' || (!user && !pico)) return;

  let content = `user: ${user}\npico: ${pico}`.trim();
  if (content.length > CHUNK_MAX_CHARS) content = content.slice(0, CHUNK_MAX_CHARS);

  const embedding = await embedText(content);
  const { error } = await (await getSupabase()).from('memory_items').insert({
    user_id: userId,
    chat_id: chatId,
    source: 'chat',
    content,
    embedding: `[${embedding.join(',')}]`,
  });
  if (error) throw new Error(`memory_items insert failed: ${error.message}`);
};

// Never lets indexing break a request.
export const indexTurnMemorySafe = (args) =>
  indexTurnMemory(args).catch((err) => logger.warn(`vector index failed: ${err.message}`));
