import { Readable } from 'node:stream';
import { llmConfig, chatConfig } from './config.js';
import { logger } from './logger.js';

export const ATTEMPT_TIMEOUT_MS = Number(process.env.LLM_ATTEMPT_TIMEOUT_MS) || 20000;

// Only these responses move the request to the next model in the chain.
// Other 4xx errors (bad request, bad key) would fail on every model, so they are returned as-is.
export const isFallbackStatus = (status) => status === 429 || status >= 500;

export const attemptModel = (model, body, signal) => {
  const timeout = AbortSignal.timeout(ATTEMPT_TIMEOUT_MS);
  // Ask the provider to append a usage object on the final SSE chunk —
  // real token counts for streamed replies instead of text-length guesses.
  const extras = body.stream ? { stream_options: { include_usage: true } } : {};
  return fetch(`${llmConfig.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${llmConfig.apiKey}`,
    },
    body: JSON.stringify({ ...chatConfig, ...body, ...extras, model }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
};

export const PUBLIC_MODEL_NAME = 'pico';

// Tries each model in order. Returns the first usable upstream response, or the last
// fallback-status response (its body is discarded, so no upstream text reaches clients).
export const fetchWithFallback = async (models, body, signal, requestId = '-') => {
  let lastStatus = null;
  let lastError = null;
  for (const model of models) {
    if (signal?.aborted) break;
    try {
      const upstream = await attemptModel(model, body, signal);
      if (!isFallbackStatus(upstream.status)) return { upstream, model };
      logger.warn(`[${requestId}] model attempt returned ${upstream.status}, trying next`);
      lastStatus = upstream.status;
      await upstream.body?.cancel().catch(() => {});
    } catch (err) {
      if (signal?.aborted) throw err;
      logger.warn(`[${requestId}] model attempt failed (${err.name}), trying next`);
      lastError = err;
    }
  }
  if (lastStatus !== null) return { upstream: null, status: lastStatus };
  throw lastError ?? new Error('No model available for this request');
};

const sanitizeSseLine = (line, parts, onUsage) => {
  const trimmed = line.trimEnd();
  if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') return line;
  try {
    const payload = JSON.parse(trimmed.slice(6));
    if (payload.usage && onUsage) onUsage(payload.usage);
    const delta = payload.choices?.[0]?.delta?.content;
    if (parts && typeof delta === 'string') parts.push(delta);
    payload.model = PUBLIC_MODEL_NAME;
    return `data: ${JSON.stringify(payload)}\n`;
  } catch {
    return line;
  }
};

async function* sanitizeSse(webStream, onDone) {
  const decoder = new TextDecoder();
  const parts = onDone ? [] : null;
  let usage = null;
  const captureUsage = (u) => { usage = u; };
  let buffer = '';
  for await (const chunk of webStream) {
    buffer += decoder.decode(chunk, { stream: true });
    let index;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index + 1);
      buffer = buffer.slice(index + 1);
      yield sanitizeSseLine(line, parts, captureUsage);
    }
  }
  buffer += decoder.decode();
  if (buffer) yield sanitizeSseLine(buffer, parts, captureUsage);
  if (parts) onDone(parts.join(''), usage);
}

// Optional onDone(fullText) fires once the stream ends with the assembled
// reply, letting callers index or audit streamed content.
export const sanitizeSseStream = (webStream, onDone) => Readable.from(sanitizeSse(webStream, onDone));

export const sanitizeCompletion = (data) =>
  data && typeof data === 'object' ? { ...data, model: PUBLIC_MODEL_NAME } : data;
