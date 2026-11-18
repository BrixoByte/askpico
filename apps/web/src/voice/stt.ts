// Unified speech-to-text for voice mode (Step 2).
//
// Two backends behind one interface:
//  - Web SpeechRecognition (Chrome/Edge): continuous + interim results,
//    bounded auto-restart on `end`, silence timeout to finalize each utterance.
//  - Android PicoBridge SpeechRecognizer (WebView has no Web Speech API):
//    the Kotlin side posts events to window.PicoVoice.
//
// The module is framework-free; the voice session controller wires handlers.
//
// Concurrency rules (fix for the endless restart loop):
//  1. Only ONE SpeechInput instance may own the microphone engine at a time
//     (SpeechInput.owner). Browsers allow a single active recognizer per page;
//     two live instances steal the mic from each other and ping-pong forever.
//  2. start() is idempotent while running, and cancels leftover timers/recognizers
//     from the previous session before starting.
//  3. Auto-restart on `end` is bounded: at most MAX_IDLE_RESTARTS consecutive
//     restarts with no speech/result in between, then the session ends cleanly.
//  4. Every deferred callback is tied to a session number, so a timer from an
//     old session can never touch a newer one.

import { speechRecognitionSupported } from '@utils/speech';
import { PicoLogger } from '@utils/logger';
import { isNativeMobileApp } from '@utils/device';

export interface SttHandlers {
  // Live interim text (not yet finalized).
  onPartial?: (text: string) => void;
  // A finalized utterance — fired on silence timeout or end-of-speech.
  // lowConfidence marks an interim result flushed at window end (Android),
  // where the engine never produced a final transcript.
  onUtterance?: (text: string, meta?: { lowConfidence?: boolean }) => void;
  // Optional veto for the Android partial-flush: return false to drop a
  // trailing partial (e.g. echo of the reply, or inside the barge-in grace).
  mayFlushPartial?: (text: string) => boolean;
  // User started speaking — used for barge-in while TTS is playing.
  onSpeechStart?: () => void;
  // message is user-facing and already generic (never raw engine errors).
  // fatal=true means the session cannot continue without user action.
  onError?: (message: string, fatal: boolean) => void;
  // Recognition fully stopped (after stop()/abort() or fatal error).
  onEnd?: () => void;
}

export interface SttOptions {
  lang?: string;
  // ms of silence after the last result before the utterance is finalized.
  silenceMs?: number;
}

const DEFAULT_SILENCE_MS = 2500;
const MAX_AUTO_RETRIES = 3;
// Max consecutive restarts after an `end` with no speech/result in between.
const MAX_IDLE_RESTARTS = 3;
const RESTART_COOLDOWN_MS = 400;
// Android voice: a listening window that ends without a final result (silence, or partial
// speech only) is re-armed at most this many times per voice session. The counter resets
// only on a final result.
const ANDROID_REARM_MAX = 3;
const ANDROID_REARM_COOLDOWN_MS = 1500;
export const ANDROID_REARM_CAP_MESSAGE = 'Voice stopped. Tap to try again.';
// An engine that ends this soon after starting, having heard nothing, is a failed start, not silence.
const QUICK_END_MS = 2000;

type WebSpeechRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onstart: (() => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  onspeechstart: (() => void) | null;
};

type SpeechRecognitionResultEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone access denied. Allow mic permission and try again.',
  'service-not-allowed': 'Microphone access denied. Allow mic permission and try again.',
  'audio-capture': 'No microphone found. Connect a mic and try again.',
  network: 'Speech recognition needs a connection. Check your network and retry.',
  'no-speech': 'No speech detected. Try again.',
  'aborted': '',
};

// Errors worth an automatic silent retry (transient engine states).
const RETRYABLE = new Set(['network', 'no-speech']);

// Codes meaning the mic permission itself is off. The UI listens for
// pico:mic-denied and opens the blocked-permission modal (with retry)
// instead of only showing the inline error strip.
const PERMISSION_DENIED = new Set(['not-allowed', 'service-not-allowed']);

const androidErrorToKey = (code: number): string => {
  switch (code) {
    case 1: // ERROR_NETWORK_TIMEOUT
    case 2: // ERROR_NETWORK
    case 4: // ERROR_SERVER
    case 11: // ERROR_SERVER_DISCONNECTED
      return 'network';
    case 3: // ERROR_AUDIO
      return 'audio-capture';
    case 5: // ERROR_CLIENT
      return 'client';
    case 6: // ERROR_SPEECH_TIMEOUT
    case 7: // ERROR_NO_MATCH
      return 'no-speech';
    case 8: // ERROR_RECOGNIZER_BUSY
      return 'busy';
    case 9: // ERROR_INSUFFICIENT_PERMISSIONS
      return 'not-allowed';
    default:
      return 'unknown';
  }
};

interface PicoVoiceBridge {
  startVoiceInput?: (lang: string) => void;
  stopVoiceInput?: () => void;
}

const picoBridge = (): PicoVoiceBridge | undefined =>
  (window as unknown as { PicoBridge?: PicoVoiceBridge }).PicoBridge;

export const sttSupported = (): boolean =>
  speechRecognitionSupported() || typeof picoBridge()?.startVoiceInput === 'function';

export class SpeechInput {
  // The single instance currently allowed to drive the engine.
  private static owner: SpeechInput | null = null;
  private static nextId = 0;

  private readonly id = ++SpeechInput.nextId;
  private handlers: SttHandlers = {};
  private options: SttOptions = {};
  private wantRunning = false;
  private rec: WebSpeechRecognition | null = null;
  private finals = '';
  private interim = '';
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private retryCount = 0;
  private idleRestarts = 0;
  private androidRearms = 0;
  // Engines that heard an onset but emitted zero results get one fresh try.
  private noResultRestarts = 0;
  private startedAt = 0;
  private heardAudio = false;
  // Bumped on every start(); deferred callbacks compare against it.
  private session = 0;
  private usingAndroid = false;
  // Android: the last interim text of the current recognizer window. If the
  // window ends without a final result it is flushed as a low-confidence
  // utterance instead of being dropped (B1).
  private pendingPartial: string | null = null;
  // Identifies the current recognizer window; a window whose partial was
  // already flushed ignores a late final for the same utterance.
  private androidWindow = 0;
  private flushedWindow = -1;

  static isSupported = sttSupported;

  private get engineBusy(): boolean {
    return this.wantRunning || this.rec !== null;
  }

  start(handlers: SttHandlers, options: SttOptions = {}) {
    // Lock 1: another instance owns the engine — never run two recognizers.
    const owner = SpeechInput.owner;
    if (owner && owner !== this && owner.engineBusy) {
      PicoLogger.info('STT', 'Ignoring start(): another SpeechInput instance owns the engine', {
        owner: owner.id,
        caller: this.id,
      });
      return;
    }
    // Lock 2: already running on this instance — duplicate call is a no-op.
    if (this.wantRunning) {
      PicoLogger.info('STT', 'Ignoring duplicate start(): already listening', { id: this.id });
      return;
    }
    SpeechInput.owner = this;

    // New session: invalidate stale timers and drop any leftover recognizer.
    this.session += 1;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    const hadRec = this.rec !== null;
    this.detachRec();

    this.handlers = handlers;
    this.options = options;
    this.wantRunning = true;
    this.retryCount = 0;
    this.idleRestarts = 0;
    this.androidRearms = 0;
    this.startedAt = Date.now();
    this.heardAudio = false;
    this.finals = '';
    this.interim = '';
    this.pendingPartial = null;
    this.flushedWindow = -1;

    PicoLogger.action('STT', 'Starting speech input', {
      id: this.id,
      lang: options.lang,
      webSpeech: speechRecognitionSupported(),
      native: typeof picoBridge()?.startVoiceInput === 'function',
    });
    // Inside the Android app the native recognizer is used: it owns the microphone with the
    // wake listener, while the WebView's Web Speech engine conflicts with the mic.
    const nativeBackend = isNativeMobileApp() && typeof picoBridge()?.startVoiceInput === 'function';
    if (!nativeBackend && speechRecognitionSupported()) {
      this.usingAndroid = false;
      if (hadRec) {
        // Previous recognizer was just aborted; let it release the mic first.
        const session = this.session;
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (!this.wantRunning || session !== this.session) return;
          this.startWeb();
        }, RESTART_COOLDOWN_MS);
      } else {
        this.startWeb();
      }
    } else if (typeof picoBridge()?.startVoiceInput === 'function') {
      this.usingAndroid = true;
      this.attachAndroid();
      try {
        PicoLogger.info('STT', 'Invoking PicoBridge.startVoiceInput');
        this.androidWindow += 1;
        picoBridge()!.startVoiceInput!(options.lang ?? navigator.language ?? 'en-US');
      } catch (error) {
        PicoLogger.error('STT', 'PicoBridge.startVoiceInput threw', error);
        this.finish();
        handlers.onError?.('Voice input failed to start. Try again.', true);
      }
    } else {
      PicoLogger.error('STT', 'No speech backend available on this device');
      this.wantRunning = false;
      handlers.onError?.('Speech recognition is not supported on this device.', true);
    }
  }

  stop() {
    this.wantRunning = false;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    if (this.usingAndroid) {
      try {
        picoBridge()?.stopVoiceInput?.();
      } catch {
        // ignore
      }
      // 'end' event from Kotlin finishes cleanup; fall back to finish() in
      // case the bridge never responds. Skipped if a new session started.
      const session = this.session;
      setTimeout(() => {
        if (session === this.session) this.finish();
      }, 500);
    } else {
      try {
        this.rec?.stop();
      } catch {
        this.finish();
      }
    }
  }

  abort() {
    this.wantRunning = false;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    if (this.usingAndroid) {
      try {
        picoBridge()?.stopVoiceInput?.();
      } catch {
        // ignore
      }
    } else {
      this.detachRec();
    }
    this.finish();
  }

  // ── Web SpeechRecognition backend ──────────────────────────────────────

  // Detaches handlers first so the aborted recognizer's late events are inert.
  private detachRec(abort = true) {
    const r = this.rec;
    this.rec = null;
    if (!r) return;
    r.onresult = null;
    r.onstart = null;
    r.onerror = null;
    r.onend = null;
    r.onspeechstart = null;
    if (abort) {
      try {
        r.abort();
      } catch {
        // already stopped
      }
    }
  }

  private startWeb() {
    // Each engine run gets its own start time, so a quick failure is judged per run, not per session.
    this.startedAt = Date.now();
    this.heardAudio = false;
    const Ctor =
      (window as { SpeechRecognition?: new () => WebSpeechRecognition }).SpeechRecognition ??
      (window as { webkitSpeechRecognition?: new () => WebSpeechRecognition })
        .webkitSpeechRecognition;
    if (!Ctor) {
      this.wantRunning = false;
      this.handlers.onError?.('Speech recognition is not supported on this device.', true);
      return;
    }

    const rec = new Ctor();
    rec.lang = this.options.lang ?? navigator.language ?? 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
    this.rec = rec;

    // Events from a recognizer that has been replaced or aborted are stale; ignore them so an
    // old onend cannot restart the new session.
    rec.onstart = () => {
      if (this.rec !== rec) return;
      PicoLogger.action('STT', 'Web SpeechRecognition engine started listening', { id: this.id });
    };
    rec.onresult = (event) => this.rec === rec && this.handleWebResult(event);
    rec.onspeechstart = () => {
      if (this.rec !== rec) return;
      this.idleRestarts = 0;
      this.heardAudio = true;
      PicoLogger.info('STT', 'Speech detected (onspeechstart)');
      this.handlers.onSpeechStart?.();
    };
    rec.onerror = (event) => {
      if (this.rec !== rec) return;
      PicoLogger.error('STT', `Web SpeechRecognition error: ${event.error ?? 'unknown'}`);
      this.handleWebError(event.error ?? '');
    };
    rec.onend = () => {
      if (this.rec !== rec) return;
      PicoLogger.info('STT', 'Web SpeechRecognition ended', {
        id: this.id,
        ranMs: Date.now() - this.startedAt,
        heardAudio: this.heardAudio,
        wantRunning: this.wantRunning,
        retryCount: this.retryCount,
        idleRestarts: this.idleRestarts,
      });
      this.handleWebEnd();
    };

    try {
      rec.start();
    } catch (error) {
      PicoLogger.error('STT', 'Web SpeechRecognition start() threw', error);
      this.rec = null;
      this.wantRunning = false;
      this.handlers.onError?.('Could not start the microphone. Try again.', true);
    }
  }

  private handleWebResult(event: SpeechRecognitionResultEvent) {
    if (!this.wantRunning) return;
    this.idleRestarts = 0;
    this.heardAudio = true;
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += transcript;
      else interimText += transcript;
    }

    if (finalText.trim() !== '') {
      PicoLogger.info('STT', `Final transcript: "${finalText.trim()}"`);
      this.finals = `${this.finals} ${finalText}`.trim();
      this.retryCount = 0;
      this.interim = interimText.trim();
      this.emitUtterance();
      return;
    }
    this.interim = interimText.trim();
    this.handlers.onPartial?.(
      [this.finals, this.interim].filter(Boolean).join(' ')
    );
    this.armSilenceTimer();
  }

  private armSilenceTimer() {
    this.clearSilenceTimer();
    const ms = this.options.silenceMs ?? DEFAULT_SILENCE_MS;
    const session = this.session;
    this.silenceTimer = setTimeout(() => {
      if (session !== this.session) return;
      this.emitUtterance();
    }, ms);
  }

  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }

  private emitUtterance() {
    // Collapse doubled words — Chrome's recognizer often repeats a word when a
    // final and interim result overlap ("just just create" -> "just create").
    const text = [this.finals, this.interim]
      .filter(Boolean)
      .join(' ')
      .replace(/\b(\p{L}+)([\s]+\1\b)+/giu, '$1')
      .trim();
    this.finals = '';
    this.interim = '';
    this.handlers.onPartial?.('');
    if (text === '') return;
    // Capture the handler before closing: closeListeningWindow() must run first so
    // wantRunning is false, but the callback may re-enter start().
    const onUtterance = this.handlers.onUtterance;
    this.closeListeningWindow();
    onUtterance?.(text);
  }

  private handleWebError(code: string) {
    if (code === 'aborted' || !this.wantRunning) return;

    if (RETRYABLE.has(code) && this.retryCount < MAX_AUTO_RETRIES) {
      this.retryCount += 1;
      // onend fires after an error; the restart happens there.
      return;
    }

    if (PERMISSION_DENIED.has(code)) {
      window.dispatchEvent(new Event('pico:mic-denied'));
    }
    const message = ERROR_MESSAGES[code] ?? 'Speech recognition failed. Try again.';
    this.wantRunning = false;
    this.handlers.onError?.(message, true);
    // Ensure cleanup even if onend doesn't fire (skipped if a new session began).
    const session = this.session;
    setTimeout(() => {
      if (session === this.session) this.finish();
    }, 300);
  }

  private handleWebEnd() {
    if (!this.wantRunning) {
      this.finish();
      return;
    }
    if (this.retryCount >= MAX_AUTO_RETRIES) {
      this.wantRunning = false;
      this.handlers.onError?.('Speech recognition keeps failing. Check your connection and try again.', true);
      this.finish(true);
      return;
    }
    // The engine can end while interim text is still pending (its own timeout beat the
    // silence timer). Flush it — without this, a partial utterance is dropped silently.
    if (this.finals !== '' || this.interim !== '') {
      PicoLogger.info('STT', 'Engine ended with pending transcript; flushing', { id: this.id });
      this.emitUtterance();
      return;
    }
    // Chrome sometimes fires onspeechstart then produces zero results: the utterance is
    // lost unless the engine is retried. One restart keeps the window alive so a repeat
    // is captured immediately instead of needing a new wake onset.
    if (this.heardAudio && this.noResultRestarts < 1) {
      this.noResultRestarts += 1;
      PicoLogger.info('STT', 'Speech heard but no transcript; restarting recognizer once', { id: this.id });
      this.detachRec();
      this.startWeb();
      return;
    }
    // Silence with no speech: a bounded restart with a growing cooldown, on a fresh recognizer.
    if (!this.heardAudio && this.idleRestarts < MAX_IDLE_RESTARTS) {
      this.idleRestarts += 1;
      const session = this.session;
      PicoLogger.info('STT', 'Idle end with no speech; restarting after cooldown', { id: this.id, attempt: this.idleRestarts });
      this.detachRec();
      this.restartTimer = setTimeout(() => {
        this.restartTimer = null;
        if (!this.wantRunning || session !== this.session) return;
        this.wantRunning = true;
        this.startWeb();
      }, RESTART_COOLDOWN_MS * this.idleRestarts);
      return;
    }
    if (!this.heardAudio) this.handlers.onError?.('No speech detected. Tap the mic to speak again.', false);
    // Listening is wake-driven: the engine is never restarted during silence. The window ends
    // here, and the session re-arms it on the next voice onset.
    PicoLogger.info('STT', 'Listening window ended; waiting for the next voice onset', {
      id: this.id,
      heardAudio: this.heardAudio,
    });
    this.wantRunning = false;
    this.finish(true);
  }

  // Ends listening as a fatal error. The session turns voice mode off, and the next mic tap
  // starts a fresh session (start() resets all state and increments the session id).
  private giveUp() {
    this.wantRunning = false;
    this.handlers.onError?.('No speech detected. Tap the mic to speak again.', true);
    this.finish(true);
  }

  private clearRestartTimer() {
    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }
  }

  // ── Android PicoBridge backend ─────────────────────────────────────────

  private picoVoice: { current: SttHandlers | null } | null = null;

  private attachAndroid() {
    const w = window as unknown as {
      PicoVoice?: {
        _emit?: (type: string, payload?: unknown) => void;
        onPartial?: (text: string) => void;
        onResult?: (text: string) => void;
        onError?: (code: number, message?: string) => void;
        onEnd?: () => void;
        onSpeechStart?: () => void;
      };
    };
    const session = this.session;
    const stale = () => session !== this.session;
    w.PicoVoice = {
      onPartial: (text) => {
        if (stale()) return;
        this.idleRestarts = 0;
        this.heardAudio = true;
        if (text.trim() !== '') this.pendingPartial = text;
        this.handlers.onPartial?.(text);
      },
      onResult: (text) => {
        PicoLogger.info('STT', `Native final result: "${text}"`);
        if (stale() || !this.wantRunning) return;
        // A late final for a window whose trailing partial already flushed is
        // the same utterance — submitting it again would double-send.
        if (this.flushedWindow === this.androidWindow) {
          PicoLogger.info('STT', 'Ignoring late final: window already flushed its partial', {
            id: this.id,
            window: this.androidWindow,
          });
          return;
        }
        this.pendingPartial = null;
        this.retryCount = 0;
        this.idleRestarts = 0;
        this.androidRearms = 0;
        const onUtterance = this.handlers.onUtterance;
        this.closeListeningWindow();
        onUtterance?.(text);
      },
      onError: (code, detail) => {
        PicoLogger.error('STT', `Native recognizer error code ${code}: ${detail ?? ''}`);
        if (stale()) return;
        const key = androidErrorToKey(code);
        if (key === 'aborted' || !this.wantRunning) return;
        // The native recognizer owns transient retries; a no-speech code only
        // arrives after its bounded idle-restart cap, so surface it to the user.
        if (key === 'no-speech') {
          // onEnd decides: it re-arms the window while the per-session cap allows it.
          return;
        }
        if (RETRYABLE.has(key)) {
          return;
        }
        if (PERMISSION_DENIED.has(key)) {
          window.dispatchEvent(new Event('pico:mic-denied'));
        }
        const message = ERROR_MESSAGES[key] ?? 'Speech recognition failed. Try again.';
        this.wantRunning = false;
        this.handlers.onError?.(message, true);
        setTimeout(() => {
          if (!stale()) this.finish();
        }, 300);
      },
      onEnd: () => {
        PicoLogger.info('STT', 'Native recognizer ended', {
          id: this.id,
          wantRunning: this.wantRunning,
          idleRestarts: this.idleRestarts,
        });
        if (stale()) return;
        // A window that ends while still wanted has no final result (a final result clears
        // wantRunning first). If it holds interim text, submit it as a low-confidence
        // utterance through the same handler a real final takes — the session's echo
        // and barge-in guards still apply downstream. Never the full text in logs.
        if (this.wantRunning) {
          const pending = this.pendingPartial;
          this.pendingPartial = null;
          const words = pending?.split(/\s+/).filter(Boolean).length ?? 0;
          if (pending && words >= 2 && (this.handlers.mayFlushPartial?.(pending) ?? true)) {
            this.flushedWindow = this.androidWindow;
            PicoLogger.info('STT', 'Window ended with partial only; flushing last partial', {
              id: this.id,
              window: this.androidWindow,
              words,
              lowConfidence: true,
            });
            const onUtterance = this.handlers.onUtterance;
            this.closeListeningWindow();
            onUtterance?.(pending, { lowConfidence: true });
            this.finish(true);
            return;
          }
          if (this.androidRearms < ANDROID_REARM_MAX) {
            this.androidRearms += 1;
            PicoLogger.info('STT', 'No final result in window; re-arming listening', {
              id: this.id,
              attempt: this.androidRearms,
              max: ANDROID_REARM_MAX,
            });
            this.clearRestartTimer();
            const rearmSession = this.session;
            this.restartTimer = setTimeout(() => {
              this.restartTimer = null;
              if (rearmSession !== this.session || !this.wantRunning) return;
              this.heardAudio = false;
              try {
                this.androidWindow += 1;
                picoBridge()?.startVoiceInput?.(this.options.lang ?? navigator.language ?? 'en-US');
              } catch (error) {
                PicoLogger.error('STT', 'Re-arm startVoiceInput threw', error);
                this.finish();
              }
            }, ANDROID_REARM_COOLDOWN_MS);
            return;
          }
          PicoLogger.info('STT', 'Re-arm cap reached; listening stopped until the next tap', {
            id: this.id,
            max: ANDROID_REARM_MAX,
          });
          this.wantRunning = false;
          this.handlers.onError?.(ANDROID_REARM_CAP_MESSAGE, false);
          this.finish(true);
          return;
        }
        this.wantRunning = false;
        this.finish(true);
      },
      onSpeechStart: () => {
        if (stale()) return;
        this.idleRestarts = 0;
        this.heardAudio = true;
        PicoLogger.info('STT', 'Native speech detected (onSpeechStart)');
        this.handlers.onSpeechStart?.();
      },
    };
  }

  // Closes the listening window once a transcript is captured. wantRunning is cleared first,
  // so the engine's onend finishes without scheduling a restart or notifying the session.
  private closeListeningWindow() {
    this.wantRunning = false;
    this.clearSilenceTimer();
    this.clearRestartTimer();
    try {
      if (this.usingAndroid) picoBridge()?.stopVoiceInput?.();
      else this.rec?.stop();
    } catch {
      // Engine already stopped.
    }
  }

  // forceEnd: notify onEnd even though wantRunning was already cleared by the caller.
  private finish(forceEnd = false) {
    this.clearSilenceTimer();
    this.clearRestartTimer();
    this.rec = null;
    const wasRunning = this.wantRunning;
    this.wantRunning = false;
    const onPartial = this.handlers.onPartial;
    const onEnd = this.handlers.onEnd;
    this.handlers = {};
    onPartial?.('');
    if (wasRunning || forceEnd || this.usingAndroid) onEnd?.();
  }
}
