// @vitest-environment jsdom
// B3 barge-in tests: the recognizer stays live while TTS plays; a user speech
// onset (>=2 non-echo words, past the 400ms grace) cuts playback and continues
// as the user's turn. Beeps, grace-window onsets, and echo of Pico's own reply
// must never cut playback.
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
    stop = vi.fn(() => {
      this.isSpeaking = false;
    });
    prefetch() {}
    speak() {
      this.isSpeaking = true;
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
import { SpeechInput } from './stt';
import { VoiceSession } from './session';

type Priv = {
  sttHandlers: {
    onPartial?: (t: string) => void;
    onUtterance?: (t: string) => void;
    onSpeechStart?: () => void;
    onEnd?: () => void;
  };
  stt: SpeechInput;
  speaker: { isSpeaking: boolean; stop: ReturnType<typeof vi.fn> };
  pendingSpeech: number;
  speakingSince: number;
  speakingText: string;
  bargeCandidateAt: number;
  lastUserText: string;
};

describe('barge-in during TTS playback', () => {
  let bridge: { startVoiceInput: ReturnType<typeof vi.fn>; stopVoiceInput: ReturnType<typeof vi.fn> };
  const sessions: VoiceSession[] = [];
  let sttStart: MockInstance;

  const newSession = () => {
    const s = new VoiceSession({ submit: vi.fn() });
    sessions.push(s);
    return s;
  };
  const priv = (s: VoiceSession) => s as unknown as Priv;

  const simulateTtsPlaying = (s: VoiceSession, sentence = 'the weather is nice today') => {
    const p = priv(s);
    p.pendingSpeech = 1;
    p.speaker.isSpeaking = true;
    p.speakingSince = Date.now() - 1000; // past the 400ms grace
    p.speakingText = sentence;
  };

  beforeEach(() => {
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
    useVoiceStore.getState().setVoiceMode(false);
  });

  it('barge-in stops queued TTS and starts a user turn', async () => {
    const submit = vi.fn();
    const s = new VoiceSession({ submit });
    sessions.push(s);
    s.start();
    simulateTtsPlaying(s);

    priv(s).sttHandlers.onSpeechStart?.();
    expect(priv(s).bargeCandidateAt).toBeGreaterThan(0);
    expect(priv(s).speaker.stop).not.toHaveBeenCalled(); // onset alone never cuts

    priv(s).sttHandlers.onPartial?.('tell me something');
    expect(priv(s).speaker.stop).toHaveBeenCalledTimes(1); // confirmed -> immediate stop

    priv(s).sttHandlers.onUtterance?.('tell me something else');
    await new Promise((r) => setTimeout(r, 10)); // merge window then submit
    expect(submit).toHaveBeenCalledTimes(1);
    expect(useVoiceStore.getState().phase).toBe('thinking');
  });

  it('onSpeechStart within 400 ms of TTS start is ignored', () => {
    const s = newSession();
    s.start();
    simulateTtsPlaying(s);
    priv(s).speakingSince = Date.now(); // TTS just started — inside grace

    priv(s).sttHandlers.onSpeechStart?.();
    expect(priv(s).bargeCandidateAt).toBe(0);
    priv(s).sttHandlers.onPartial?.('hello there');
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
  });

  it('a speech onset with fewer than 2 words is not a barge-in', () => {
    const s = newSession();
    s.start();
    simulateTtsPlaying(s);

    priv(s).sttHandlers.onSpeechStart?.();
    priv(s).sttHandlers.onPartial?.('wait'); // 1 word
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
    priv(s).sttHandlers.onUtterance?.('hey'); // 1-word final
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
  });

  it('echo of the reply itself is not a barge-in', () => {
    const s = newSession();
    s.start();
    simulateTtsPlaying(s, 'the weather is nice today');

    priv(s).sttHandlers.onSpeechStart?.();
    priv(s).sttHandlers.onPartial?.('the weather is'); // echo of own reply
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
    priv(s).sttHandlers.onUtterance?.('nice today');
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
  });

  it('a late partial echoing the just-submitted question is not a barge-in', () => {
    // Seen on device: resuming the recognizer at reply start can flush a partial
    // made of the user's own question audio tail; it must not cut playback.
    const s = newSession();
    s.start();
    simulateTtsPlaying(s, 'once upon a time there was a dragon');
    priv(s).lastUserText = 'tell me a story about a dragon';

    priv(s).sttHandlers.onSpeechStart?.();
    priv(s).sttHandlers.onPartial?.('about a dragon'); // question tail, not reply
    expect(priv(s).speaker.stop).not.toHaveBeenCalled();
  });

  it('recognizer is not stopped during TTS playback', async () => {
    const s = newSession();
    s.start();
    const abortSpy = vi.spyOn(priv(s).stt, 'abort');

    (s as unknown as { enqueueSpeech: (t: string) => void }).enqueueSpeech('reply sentence one');
    await new Promise((r) => setTimeout(r, 10));

    expect(abortSpy).not.toHaveBeenCalled();
    expect(priv(s).speaker.isSpeaking).toBe(true);
  });

  it('normal reply without interruption completes and the queue drains in order', async () => {
    const spoken: string[] = [];
    const s = newSession();
    sessions.push(s);
    s.start();
    vi.spyOn(priv(s).speaker as unknown as { speak: (t: string) => Promise<void> }, 'speak');
    const speaker = priv(s).speaker as unknown as {
      speak: (t: string) => Promise<void>;
      isSpeaking: boolean;
    };
    speaker.speak = async (t: string) => {
      speaker.isSpeaking = true;
      spoken.push(t);
      speaker.isSpeaking = false;
    };

    const p = s as unknown as { enqueueSpeech: (t: string) => void };
    p.enqueueSpeech('first sentence.');
    p.enqueueSpeech('second sentence.');
    await new Promise((r) => setTimeout(r, 30));

    expect(spoken).toEqual(['first sentence.', 'second sentence.']);
    expect(priv(s).pendingSpeech).toBe(0);
    // After the drain the bounded follow-up window is open and listening is back.
    expect((s as unknown as { followUpEndsAt: number }).followUpEndsAt).toBeGreaterThan(0);
  });
});
