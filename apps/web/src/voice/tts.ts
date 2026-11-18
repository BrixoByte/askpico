// Text-to-speech output for voice mode (Step 4).
//
// Fallback chain — voice never goes fully silent:
//   1. POST /api/tts  → server-side provider chain (Edge TTS proxy behind a
//      flag → laptop TTS service). Returns 503 when all providers are down.
//   2. speechSynthesis in the user's own browser (always available where the
//      Web Speech API isn't required).
//
// Server audio is played through a Web Audio filter chain (high-pass +
// presence EQ + gentle gain) to give Pico's voice a consistent character;
// browsers without AudioContext get plain <audio> playback.

import { backendUrl } from '@api/api';
import { getAccessToken } from '@api/supabase';
import { devLaptopTtsUrl } from './devLaptopTts';
import { detectSpeechLang, toSpeakableText } from './sentenceChunker';
import { sharedAudioContext } from './sharedAudio';
import { voiceLatency } from './VoiceDebugLogger';
import { PicoLogger } from '@utils/logger';

const TTS_ENDPOINT = `${backendUrl}/api/tts`;
// A provider that never answers must not stall the reply: give up and fall through.
const SERVER_TTS_TIMEOUT_MS = 8000;
// Some Android WebViews never fire onstart for speechSynthesis; treat that as failed.
const BROWSER_TTS_START_TIMEOUT_MS = 4000;
// Native TTS reports completion; this only guards against an engine that never finishes.
const NATIVE_TTS_TIMEOUT_MS = 30000;
// Android WebView fills getVoices() asynchronously; speak once the list arrives or after this wait.
const VOICE_LOAD_TIMEOUT_MS = 1500;
// Abort reason for cancels by stop()/barge-in. Only real failures set the sticky browser fallback.
const STOPPED = 'tts-stopped';
// If the server has not returned audio within this window, the device voice speaks the
// sentence now. The server request keeps running, but its audio is dropped. Keep this
// above the normal server synthesis time (Edge TTS is ~400-800 ms per short sentence)
// or every turn silently falls back to the browser voice.
const SERVER_TTS_WAIT_MS = 2500;
const SERVER_FAILURES_BEFORE_FALLBACK = 3;

const waitForVoices = (timeoutMs: number): Promise<SpeechSynthesisVoice[]> =>
  new Promise((resolve) => {
    const synth = window.speechSynthesis;
    if (synth.getVoices().length > 0) return resolve(synth.getVoices());
    const done = () => {
      clearTimeout(timer);
      synth.removeEventListener('voiceschanged', done);
      resolve(synth.getVoices());
    };
    const timer = setTimeout(done, timeoutMs);
    synth.addEventListener('voiceschanged', done);
  });

// Browsers only allow speech and audio output that starts from a user gesture. Replies arrive
// after network work, so the first tap or key press unlocks both the audio context and speech.
export const unlockVoiceAudio = () => {
  sharedAudioContext();
  if (!('speechSynthesis' in window)) return;
  const silent = new SpeechSynthesisUtterance(' ');
  silent.volume = 0;
  window.speechSynthesis.speak(silent);
};

if (typeof document !== 'undefined') {
  const unlockOnGesture = () => {
    unlockVoiceAudio();
    for (const type of ['pointerdown', 'keydown'] as const) {
      document.removeEventListener(type, unlockOnGesture, true);
    }
  };
  for (const type of ['pointerdown', 'keydown'] as const) {
    document.addEventListener(type, unlockOnGesture, true);
  }
}

// ── Native Android speech (PicoBridge.speak) ──────────────────────────────
// Inside the Android app the WebView often has no working speechSynthesis, so reply speech goes
// through Android's TextToSpeech. Completion comes back via window.PicoTTS.onDone(id).

type PicoTtsBridge = { speak?: (id: string, text: string, lang: string) => void; stopSpeaking?: () => void };
const nativeTts = (): PicoTtsBridge | undefined =>
  (window as unknown as { PicoBridge?: PicoTtsBridge }).PicoBridge;
const nativeDone = new Map<string, () => void>();

const playNativeSpeech = (text: string, lang: string): Promise<boolean> => {
  const bridge = nativeTts();
  if (!bridge?.speak) return Promise.resolve(false);
  (window as unknown as { PicoTTS?: { onDone: (id: string) => void } }).PicoTTS = {
    onDone: (id) => nativeDone.get(id)?.(),
  };
  PicoLogger.info('TTS', 'Speaking reply with native Android TTS', { chars: text.length, lang });
  return new Promise((resolve) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const finish = () => {
      clearTimeout(timer);
      nativeDone.delete(id);
      resolve(true);
    };
    const timer = setTimeout(finish, NATIVE_TTS_TIMEOUT_MS);
    nativeDone.set(id, finish);
    bridge.speak!(id, text, lang);
  });
};

const stopNativeSpeech = () => {
  try {
    nativeTts()?.stopSpeaking?.();
  } catch {
    // ignore: native bridge unavailable
  }
  for (const done of [...nativeDone.values()]) done();
};

// ── Web Audio filter chain ────────────────────────────────────────────────
// High-pass removes rumble, a small presence boost keeps voice clear on
// laptop speakers, and a soft limiter-ish gain prevents clipping.

let outputAnalyser: AnalyserNode | null = null;

export const getOutputAnalyser = (): AnalyserNode | null => outputAnalyser;

// Every AI speech chain feeds this bus, so the call recorder can tap it.
let outputBus: GainNode | null = null;

export const voiceOutputBus = (ctx: AudioContext): GainNode => {
  if (!outputBus || outputBus.context !== ctx) {
    outputBus = ctx.createGain();
    outputBus.connect(ctx.destination);
  }
  return outputBus;
};

const buildVoiceChain = (ctx: AudioContext, destination: AudioNode) => {
  const highpass = ctx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 90;
  highpass.Q.value = 0.7;

  const presence = ctx.createBiquadFilter();
  presence.type = 'peaking';
  presence.frequency.value = 3200;
  presence.gain.value = 1.5;
  presence.Q.value = 1.0;

  const warmth = ctx.createBiquadFilter();
  warmth.type = 'lowshelf';
  warmth.frequency.value = 220;
  warmth.gain.value = 1.0;

  const gain = ctx.createGain();
  gain.gain.value = 0.95;

  highpass.connect(presence);
  presence.connect(warmth);
  warmth.connect(gain);
  gain.connect(destination);
  return { input: highpass, gain };
};

// Chrome can garbage-collect a SpeechSynthesisUtterance that nothing references, which ends it
// before it plays. Utterances in flight are held here until their onend or onerror runs.
const activeUtterances: SpeechSynthesisUtterance[] = [];
const releaseUtterance = (utterance: SpeechSynthesisUtterance) => {
  const index = activeUtterances.indexOf(utterance);
  if (index >= 0) activeUtterances.splice(index, 1);
};

// ── Speaker ───────────────────────────────────────────────────────────────

export class Speaker {
  private audio: HTMLAudioElement | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private inflight = new Set<AbortController>();
  private prefetched = new Map<string, Promise<Blob | 'stopped' | null>>();
  private resolveCurrent: (() => void) | null = null;
  private serverFailed = false;
  private serverFailures = 0;

  get isSpeaking(): boolean {
    return this.resolveCurrent !== null;
  }

  // Speak one sentence/utterance. Resolves when playback ends or stop() is
  // called. Never rejects — failures degrade to the next provider.
  speak(text: string): Promise<void> {
    const clean = toSpeakableText(text);
    if (clean === '') return Promise.resolve();
    if (this.resolveCurrent) return Promise.resolve(); // queue handled by caller

    return new Promise<void>((resolve) => {
      this.resolveCurrent = resolve;
      void this.play(clean).finally(() => {
        this.resolveCurrent = null;
        resolve();
      });
    });
  }

  // Starts the server request for a sentence that is queued but not yet spoken, so its
  // audio is ready when the sentence before it finishes playing.
  prefetch(text: string) {
    const clean = toSpeakableText(text);
    if (clean === '' || this.serverFailed || this.prefetched.has(clean)) return;
    this.prefetched.set(
      clean,
      this.fetchServerAudio(clean, detectSpeechLang(clean)).catch(() => null),
    );
  }

  private async play(text: string) {
    const lang = detectSpeechLang(text);
    if (!this.serverFailed) {
      const audio = await this.raceServerAudio(text, lang);
      if (audio === 'stopped') return;
      if (audio && audio !== 'slow') {
        this.serverFailures = 0;
        await this.playBlob(audio);
        return;
      }
      // A single failed sentence is retried on the next one. Repeated failures mean the server
      // chain is down, so stop paying a failing round-trip per sentence for this session.
      if (audio === null && ++this.serverFailures >= SERVER_FAILURES_BEFORE_FALLBACK) {
        this.serverFailed = true;
      }
    }
    if (await playNativeSpeech(text, lang)) return;
    PicoLogger.info('TTS', 'Using browser speech fallback for reply chunk', { serverFailed: this.serverFailed, chars: text.length });
    await this.playBrowserSpeech(text, lang);
  }

  // Server audio if it arrives within SERVER_TTS_WAIT_MS, otherwise 'slow'.
  private raceServerAudio(text: string, lang: string): Promise<Blob | 'stopped' | 'slow' | null> {
    const pending = this.takeServerAudio(text, lang);
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve('slow'), SERVER_TTS_WAIT_MS);
      void pending.then(
        (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
      );
    });
  }

  private takeServerAudio(text: string, lang: string): Promise<Blob | 'stopped' | null> {
    const pending = this.prefetched.get(text);
    this.prefetched.delete(text);
    return pending ?? this.fetchServerAudio(text, lang);
  }

  // Resolves with the audio, 'stopped' when cancelled by stop()/barge-in, or null on a real
  // HTTP/network/timeout failure. Only null switches the session to the browser voice.
  private fetchServerAudio(text: string, lang: string): Promise<Blob | 'stopped' | null> {
    const controller = new AbortController();
    this.inflight.add(controller);
    const timer = setTimeout(() => controller.abort(new Error('tts timeout')), SERVER_TTS_TIMEOUT_MS);
    return (async () => {
      try {
        const laptopUrl = devLaptopTtsUrl();
        const token = laptopUrl ? null : await getAccessToken().catch(() => null);
        const response = await fetch(laptopUrl ?? TTS_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          // The laptop service speaks the server-side schema: it wants `voice`,
          // not `lang`. Extra fields are ignored by both endpoints.
          body: JSON.stringify(laptopUrl ? { text, voice: 'en-US-AriaNeural' } : { text, lang }),
          signal: controller.signal,
        });
        if (!response.ok) {
          PicoLogger.error('TTS', `Server TTS responded ${response.status}, falling back to browser speech`);
          return null;
        }
        return await response.blob();
      } catch (error) {
        if (controller.signal.reason === STOPPED) return 'stopped';
        PicoLogger.error('TTS', 'Server TTS failed or timed out, falling back to browser speech', error);
        return null;
      } finally {
        clearTimeout(timer);
        this.inflight.delete(controller);
      }
    })();
  }

  private async playBlob(blob: Blob) {
    // Prefer the filtered Web Audio path; fall back to a plain element.
    try {
      const ctx = sharedAudioContext();
      if (!ctx) throw new Error('no AudioContext');
      if (ctx.state === 'suspended') await ctx.resume();

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.onplaying = () => voiceLatency.markPlaybackStarted();
      this.audio = audio;

      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.connect(voiceOutputBus(ctx));
      outputAnalyser = analyser;
      const chain = buildVoiceChain(ctx, analyser);
      source.connect(chain.input);
      this.sourceNode = source;

      await new Promise<void>((resolve, reject) => {
        audio.onended = () => resolve();
        audio.onerror = () => reject(new Error('audio playback failed'));
        audio.play().catch(reject);
      });
      URL.revokeObjectURL(url);
    } catch {
      // Filter path unavailable — plain playback still works.
      await this.playBlobPlain(blob);
    } finally {
      this.sourceNode?.disconnect();
      this.sourceNode = null;
      this.audio = null;
    }
  }

  private playBlobPlain(blob: Blob): Promise<void> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      this.audio = audio;
      audio.onplaying = () => voiceLatency.markPlaybackStarted();
      audio.onended = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      audio.play().catch(() => resolve());
    });
  }

  private async playBrowserSpeech(text: string, lang: string): Promise<void> {
    if (!('speechSynthesis' in window)) return;
    const voices = await waitForVoices(VOICE_LOAD_TIMEOUT_MS);
    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      // Prefer an installed voice that matches the detected language; without
      // this Chrome picks any default voice and mangles non-Latin scripts.
      const prefix = lang.split('-')[0];
      const match =
        voices.find((v) => v.lang === lang) ??
        voices.find((v) => v.lang?.toLowerCase().startsWith(prefix));
      if (match) utterance.voice = match;
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;
      let started = false;
      const finish = () => {
        clearTimeout(watchdog);
        resolve();
      };
      const watchdog = setTimeout(() => {
        if (started) return;
        PicoLogger.error('TTS', 'speechSynthesis never started, skipping this reply chunk');
        releaseUtterance(utterance);
        window.speechSynthesis.cancel();
        finish();
      }, BROWSER_TTS_START_TIMEOUT_MS);
      let startedAt = 0;
      utterance.onstart = () => {
        started = true;
        startedAt = performance.now();
        console.log('[VoiceDebug] tts start', { chars: text.length });
        voiceLatency.markPlaybackStarted();
      };
      utterance.onend = () => {
        console.log('[VoiceDebug] tts end', { ms: Math.round(performance.now() - startedAt) });
        releaseUtterance(utterance);
        finish();
      };
      utterance.onerror = (e) => {
        console.log('[VoiceDebug] tts error', e.error);
        PicoLogger.error('TTS', `speechSynthesis error: ${e.error}`);
        releaseUtterance(utterance);
        finish();
      };
      PicoLogger.info('TTS', 'speechSynthesis.speak() called', { voice: match?.name ?? 'default', lang });
      console.log('[VoiceDebug] tts speak', {
        chars: text.length,
        speaking: window.speechSynthesis.speaking,
        paused: window.speechSynthesis.paused,
        pending: window.speechSynthesis.pending,
      });
      // Clear a stale queue only when nothing of ours is in flight: cancelling mid-utterance
      // ends that utterance at once.
      if (
        activeUtterances.length === 0 &&
        (window.speechSynthesis.speaking || window.speechSynthesis.pending)
      ) {
        window.speechSynthesis.cancel();
      }
      if (window.speechSynthesis.paused) window.speechSynthesis.resume();
      activeUtterances.push(utterance);
      window.speechSynthesis.speak(utterance);
    });
  }

  // Immediate stop: abort in-flight TTS fetch, pause audio, cancel any
  // browser utterance. Barge-in target is well under one second.
  stop() {
    if (this.resolveCurrent) console.trace('[VoiceDebug] speaker.stop() cut a reply in progress');
    for (const controller of this.inflight) controller.abort(STOPPED);
    this.inflight.clear();
    this.prefetched.clear();
    try {
      this.audio?.pause();
    } catch {
      // ignore
    }
    this.audio = null;
    try {
      this.sourceNode?.disconnect();
    } catch {
      // ignore
    }
    this.sourceNode = null;
    stopNativeSpeech();
    activeUtterances.length = 0;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      // ignore
    }
    const done = this.resolveCurrent;
    this.resolveCurrent = null;
    done?.();
  }

  dispose() {
    this.stop();
  }
}
