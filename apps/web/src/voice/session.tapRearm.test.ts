// @vitest-environment jsdom
// Regression tests for the post-cap tap-recovery bug: after the re-arm cap the
// session stays `active` with a dead recognizer, so the next tap must call
// stt.start() again (which resets the re-arm counter and invokes
// PicoBridge.startVoiceInput). Before the fix, session.start() early-returned
// on `active` and the tap did nothing — the UI showed "Listening..." with no
// native session running.
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';

vi.mock('@utils/device', () => ({ isNativeMobileApp: () => true }));
vi.mock('@utils/speech', () => ({ speechRecognitionSupported: () => false }));
vi.mock('@utils/logger', () => ({
  PicoLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
}));
vi.mock('@api/api', () => ({ notifyVoiceSessionComplete: vi.fn() }));
vi.mock('@hooks/useAddChat', () => ({ selectOrCreateChat: vi.fn(async () => null) }));
vi.mock('./tts', () => ({
  Speaker: class {
    stop() {}
    speak() {
      return Promise.resolve();
    }
  },
}));
vi.mock('./callRecorder', () => ({
  CallRecorder: class {
    start() {
      return true;
    }
    stop() {}
  },
}));
vi.mock('./audioLevel', () => ({
  currentLevel: () => 0,
  currentMicStream: () => null,
  startMicLevel: () => Promise.resolve(),
  stopMicLevel: () => {},
}));
vi.mock('./VoiceDebugLogger', () => ({ voiceLatency: { mark: vi.fn(), flush: vi.fn() } }));

import { ANDROID_REARM_CAP_MESSAGE, SpeechInput } from './stt';
import { VoiceSession } from './session';

describe('post-cap tap re-arm', () => {
  let bridge: { startVoiceInput: ReturnType<typeof vi.fn> };
  let sttStart: MockInstance;
  const sessions: VoiceSession[] = [];

  const newSession = () => {
    const s = new VoiceSession({ submit: vi.fn() });
    sessions.push(s);
    return s;
  };

  beforeEach(() => {
    bridge = { startVoiceInput: vi.fn() };
    (window as unknown as { PicoBridge?: unknown }).PicoBridge = bridge;
    sttStart = vi.spyOn(SpeechInput.prototype, 'start');
    localStorage.clear();
  });

  afterEach(() => {
    for (const s of sessions) (s as unknown as { stt: SpeechInput }).stt.abort();
    sessions.length = 0;
    (SpeechInput as unknown as { owner: unknown }).owner = null;
    vi.restoreAllMocks();
  });

  it('tap after re-arm cap restarts the recognizer once', () => {
    const session = newSession();
    session.start();
    expect(sttStart).toHaveBeenCalledTimes(1);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);

    // Drive to the capped state: non-fatal cap error clears `listening` but
    // leaves the session active — exactly what stt.ts emits at ANDROID_REARM_MAX.
    const handlers = (session as unknown as { sttHandlers: { onError?: (m: string, f: boolean) => void } })
      .sttHandlers;
    handlers.onError?.(ANDROID_REARM_CAP_MESSAGE, false);
    // The native side is dead at the cap as well (wantRunning cleared on finish).
    (session as unknown as { stt: SpeechInput }).stt.abort();

    session.start(); // user taps "try again"
    expect(sttStart).toHaveBeenCalledTimes(2);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('tap during an active listening window is a no-op', () => {
    const session = newSession();
    session.start();
    expect(sttStart).toHaveBeenCalledTimes(1);

    session.start(); // session is listening — tap must do nothing
    expect(sttStart).toHaveBeenCalledTimes(1);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);
  });

  it('two rapid taps after the cap start only once', () => {
    const session = newSession();
    session.start();
    const handlers = (session as unknown as { sttHandlers: { onError?: (m: string, f: boolean) => void } })
      .sttHandlers;
    handlers.onError?.(ANDROID_REARM_CAP_MESSAGE, false);
    (session as unknown as { stt: SpeechInput }).stt.abort();

    session.start();
    session.start(); // second tap lands while startStt has already set listening
    expect(sttStart).toHaveBeenCalledTimes(2);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('tap during the re-arm cooldown does not double-start', () => {
    const session = newSession();
    session.start();
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);

    // Cooldown state: session-level onEnd cleared `listening`, but stt still
    // owns a live window (wantRunning true) that its own timer is re-arming.
    const handlers = (session as unknown as { sttHandlers: { onEnd?: () => void } }).sttHandlers;
    handlers.onEnd?.();

    session.start(); // stt.start() hits its duplicate-start lock — no new native call
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);
  });
});
