// @vitest-environment jsdom
// B2 bounded follow-up window: after a reply (and at session start) the mic
// listens for FOLLOW_UP_MS only. Silence past it -> idle teardown (no cap
// message, no "Listening"). Beep-only onsets do not extend it. A tap after
// expiry starts exactly one new session.
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
    isSpeaking = false;
    stop() {
      this.isSpeaking = false;
    }
    prefetch() {}
    speak() {
      return Promise.resolve();
    }
    dispose() {}
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
vi.mock('./VoiceDebugLogger', () => ({
  voiceLatency: {
    mark: vi.fn(),
    flush: vi.fn(),
    markAudioSent: vi.fn(),
    markResponseReceived: vi.fn(),
    markPlaybackStarted: vi.fn(),
  },
}));

import useVoiceStore from '@store/voice-store';
import { ANDROID_REARM_CAP_MESSAGE, SpeechInput } from './stt';
import { VoiceSession } from './session';

type Priv = {
  sttHandlers: {
    onPartial?: (t: string) => void;
    onUtterance?: (t: string) => void;
    onSpeechStart?: () => void;
    onError?: (m: string, f: boolean) => void;
    onEnd?: () => void;
  };
  stt: SpeechInput;
  active: boolean;
};

describe('bounded follow-up window', () => {
  let bridge: { startVoiceInput: ReturnType<typeof vi.fn>; stopVoiceInput: ReturnType<typeof vi.fn> };
  const sessions: VoiceSession[] = [];
  let sttStart: MockInstance;

  const newSession = (submit = vi.fn()) => {
    const s = new VoiceSession({ submit });
    sessions.push(s);
    return s;
  };
  const priv = (s: VoiceSession) => s as unknown as Priv;

  beforeEach(() => {
    vi.useFakeTimers();
    bridge = { startVoiceInput: vi.fn(), stopVoiceInput: vi.fn() };
    (window as unknown as { PicoBridge?: unknown }).PicoBridge = bridge;
    sttStart = vi.spyOn(SpeechInput.prototype, 'start');
    useVoiceStore.getState().setVoiceMode(true);
    localStorage.clear();
  });

  afterEach(() => {
    for (const s of sessions) priv(s).stt.abort();
    sessions.length = 0;
    (SpeechInput as unknown as { owner: unknown }).owner = null;
    vi.restoreAllMocks();
    vi.useRealTimers();
    useVoiceStore.getState().setVoiceMode(false);
  });

  it('stops the recognizer and goes idle when no speech occurs within 8 s', () => {
    const s = newSession();
    s.start();
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(8000);
    expect(useVoiceStore.getState().phase).toBe('idle');
    expect(useVoiceStore.getState().voiceMode).toBe(false);
    expect(priv(s).active).toBe(false);
    // No cap message — expiry is silent idle, not an error.
    expect(useVoiceStore.getState().error).not.toBe(ANDROID_REARM_CAP_MESSAGE);
  });

  it('speech inside the window keeps the turn running', async () => {
    const submit = vi.fn();
    const s = newSession(submit);
    s.start();

    vi.advanceTimersByTime(5000); // still inside the 8 s window
    priv(s).sttHandlers.onUtterance?.('what is the time');
    await vi.advanceTimersByTimeAsync(10); // merge window -> submit

    expect(submit).toHaveBeenCalledTimes(1);
    expect(priv(s).active).toBe(true); // turn in flight — no idle
    vi.advanceTimersByTime(10_000);
    expect(priv(s).active).toBe(true);
    expect(useVoiceStore.getState().phase).toBe('thinking');
  });

  it('a beep-only onset does not extend the window', () => {
    const s = newSession();
    s.start();

    vi.advanceTimersByTime(4000);
    priv(s).sttHandlers.onSpeechStart?.(); // recognizer beep: onset, no words
    vi.advanceTimersByTime(4100); // past the absolute 8 s deadline

    expect(useVoiceStore.getState().phase).toBe('idle');
    expect(priv(s).active).toBe(false);
  });

  it('after expiry the phase is idle and no re-arm occurs', () => {
    const s = newSession();
    s.start();
    vi.advanceTimersByTime(8000);
    const calls = bridge.startVoiceInput.mock.calls.length;
    vi.advanceTimersByTime(30_000); // long silence after expiry
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(calls); // nothing re-armed
    expect(useVoiceStore.getState().phase).toBe('idle');
  });

  it('tap after expiry starts exactly one recognizer session', () => {
    const s = newSession();
    s.start();
    vi.advanceTimersByTime(8000); // expired -> idle teardown

    useVoiceStore.getState().setVoiceMode(true); // the UI tap path
    s.start();
    expect(sttStart).toHaveBeenCalledTimes(2);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(2);
    // and a fresh window is open again
    expect((s as unknown as { followUpEndsAt: number }).followUpEndsAt).toBeGreaterThan(Date.now());
  });

  it('tap during an active window does not start a second recognizer', () => {
    const s = newSession();
    s.start();
    vi.advanceTimersByTime(3000);

    s.start(); // tap while the window is live
    expect(sttStart).toHaveBeenCalledTimes(1);
    expect(bridge.startVoiceInput).toHaveBeenCalledTimes(1);
  });

  it('cap message still shown when the re-arm cap is hit inside a window', () => {
    const s = newSession();
    s.start();
    vi.advanceTimersByTime(2000); // inside the window

    priv(s).sttHandlers.onError?.(ANDROID_REARM_CAP_MESSAGE, false);
    expect(useVoiceStore.getState().error).toBe(ANDROID_REARM_CAP_MESSAGE);
    expect(useVoiceStore.getState().voiceMode).toBe(false);
  });
});
