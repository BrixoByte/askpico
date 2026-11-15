// TTS provider chain for voice mode (Step 4).
//
// Order is configuration-driven so a broken provider is swapped without a
// code change:
//   1. edge   — Microsoft Edge TTS via msedge-tts (primary, behind the
//               EDGE_TTS_ENABLED feature flag; unofficial endpoint).
//   2. laptop — a self-hosted TTS service (edge-tts lib or Kokoro-82M behind
//               a Cloudflare Tunnel; English only for Kokoro), reached over
//               TTS_SERVICE_URL.
// The client always keeps speechSynthesis as the last resort, so when every
// provider fails this endpoint returns 503 and the browser speaks instead.

import { Readable } from 'node:stream';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { logger } from './logger.js';

const MAX_TEXT_LENGTH = 1200;
const PROVIDER_TIMEOUT_MS = 15000;
const RATE_LIMIT_PER_MINUTE = 60;

// ── Config ────────────────────────────────────────────────────────────────

const providers = (process.env.TTS_PROVIDERS || 'edge,laptop')
  .split(',')
  .map((p) => p.trim())
  .filter(Boolean);

const edgeEnabled = process.env.EDGE_TTS_ENABLED === 'true';
const ttsVoice = process.env.TTS_VOICE || 'en-US-AriaNeural';
const laptopUrl = (process.env.TTS_SERVICE_URL || '').replace(/\/+$/, '');

// Per-language Edge voices — a reply in Urdu or Hindi must be spoken by a
// matching voice, otherwise the English voice mangles it into gibberish.
// Urdu is the default. If its voice fails, the chain moves to Hindi, then English.
const LANG_VOICES = {
  ur: ['ur-PK-UzmaNeural', 'hi-IN-SwaraNeural', 'en-US-AriaNeural'],
  hi: ['hi-IN-SwaraNeural', 'en-US-AriaNeural'],
  en: ['en-US-AriaNeural'],
};

const voicesForLang = (lang) => {
  const prefix = String(lang || '').toLowerCase().split('-')[0];
  return LANG_VOICES[prefix] ?? LANG_VOICES.ur;
};

const voiceForLang = (lang) => voicesForLang(lang)[0] ?? ttsVoice;

// ── Simple per-IP rate limit (TTS is the costliest voice-path call) ───────

const buckets = new Map();

const rateLimited = (key) => {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    buckets.set(key, { count: 1, reset: now + 60_000 });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MINUTE;
};

// Periodically drop stale buckets so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now > bucket.reset) buckets.delete(key);
  }
}, 60_000).unref();

// ── Providers ─────────────────────────────────────────────────────────────
// Each returns { stream: Readable, contentType } or throws.

// Resolves once the provider has produced its first audio bytes. Errors or an empty stream that
// happen before that point reject here, so the next voice or provider is tried. Without this, a
// provider that fails after the HTTP response has started turns into a 502 with no fallback.
const FIRST_AUDIO_TIMEOUT_MS = 10000;
const firstAudio = (stream) =>
  new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      stream.off('error', onError);
      stream.off('end', onEnd);
      stream.off('readable', onReadable);
    };
    const fail = (err) => {
      cleanup();
      stream.destroy();
      reject(err);
    };
    const onError = (err) => fail(err);
    const onEnd = () => fail(new Error('provider stream ended before any audio'));
    const onReadable = () => {
      const chunk = stream.read();
      if (chunk === null) return;
      cleanup();
      stream.unshift(chunk);
      resolve(stream);
    };
    const timer = setTimeout(() => fail(new Error('provider sent no audio in time')), FIRST_AUDIO_TIMEOUT_MS);
    stream.on('error', onError);
    stream.on('end', onEnd);
    stream.on('readable', onReadable);
  });

// The Edge endpoint is unofficial and drops connections intermittently. Each voice gets two
// attempts, and Edge setups run one at a time so parallel sentence requests don't open a burst of
// sockets that the endpoint rejects.
const EDGE_ATTEMPTS_PER_VOICE = 2;
const EDGE_RETRY_DELAY_MS = 400;
let edgeQueue = Promise.resolve();
const runEdgeSetup = (task) => {
  const run = edgeQueue.then(task, task);
  edgeQueue = run.catch(() => {});
  return run;
};

const edgeStream = async (text, voice) => {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const { audioStream } = tts.toStream(text);
  const stream = audioStream instanceof Readable ? audioStream : Readable.fromWeb(audioStream);
  return { stream: await firstAudio(stream), contentType: 'audio/mpeg' };
};

const edgeProvider = async (text, lang) => {
  let lastError;
  for (const voice of voicesForLang(lang)) {
    for (let attempt = 1; attempt <= EDGE_ATTEMPTS_PER_VOICE; attempt++) {
      try {
        return await runEdgeSetup(() => edgeStream(text, voice));
      } catch (err) {
        lastError = err;
        logger.warn(`tts: edge voice ${voice} attempt ${attempt} failed: ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, EDGE_RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
};

const laptopProvider = async (text, lang) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const upstream = await fetch(`${laptopUrl}/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: voiceForLang(lang) }),
      signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      throw new Error(`laptop TTS responded ${upstream.status}`);
    }
    const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
    return {
      stream: await firstAudio(Readable.fromWeb(upstream.body)),
      contentType,
    };
  } finally {
    clearTimeout(timer);
  }
};

const providerImpl = {
  edge: edgeEnabled ? edgeProvider : null,
  laptop: laptopUrl ? laptopProvider : null,
};

export const ttsStatus = () => ({
  enabled: providers.some((p) => providerImpl[p]),
  providers: providers.filter((p) => providerImpl[p]),
  voice: ttsVoice,
});

// Returns { stream, contentType, provider } or null when every provider fails.
export const synthesize = async (text, lang) => {
  for (const name of providers) {
    const impl = providerImpl[name];
    if (!impl) continue;
    try {
      const result = await impl(text, lang);
      logger.info(`tts: synthesized via ${name} (${text.length} chars, lang=${lang || 'default'})`);
      return { ...result, provider: name };
    } catch (err) {
      logger.warn(`tts: provider ${name} failed: ${err.message}`);
    }
  }
  return null;
};

export const isRateLimited = rateLimited;
export const maxTextLength = MAX_TEXT_LENGTH;
