// @vitest-environment jsdom
// B1: an Android recognizer window that ends with interim text but no final
// result flushes the last partial as a low-confidence utterance instead of
// dropping it — once, never twice.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/device', () => ({ isNativeMobileApp: () => true }));
vi.mock('@utils/speech', () => ({ speechRecognitionSupported: () => false }));
vi.mock('@utils/logger', () => ({
  PicoLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
}));

import { SpeechInput } from './stt';

type Native = {
  startVoiceInput: ReturnType<typeof vi.fn>;
  stopVoiceInput: ReturnType<typeof vi.fn>;
};
type PicoVoice = {
  onPartial: (t: string) => void;
  onResult: (t: string) => void;
  onError: (code: number, detail?: string) => void;
  onEnd: () => void;
  onSpeechStart: () => void;
};

const native = (): Native => (window as unknown as { PicoBridge: Native }).PicoBridge;
const voice = (): PicoVoice => (window as unknown as { PicoVoice: PicoVoice }).PicoVoice;
const REARM_MS = 1500;

let input: SpeechInput | null = null;
let handlers: Record<string, ReturnType<typeof vi.fn>> = {};

const startSession = (extra: Record<string, unknown> = {}) => {
  input = new SpeechInput();
  handlers = {
    onError: vi.fn(),
    onUtterance: vi.fn(),
    onPartial: vi.fn(),
    onSpeechStart: vi.fn(),
    ...extra,
  } as Record<string, ReturnType<typeof vi.fn>>;
  input.start(handlers as never, { lang: 'en-US' });
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  (window as unknown as { PicoBridge: Native }).PicoBridge = {
    startVoiceInput: vi.fn(),
    stopVoiceInput: vi.fn(),
  };
});

afterEach(() => {
  input?.stop();
  input = null;
  vi.useRealTimers();
});

describe('Android partial flush at window end (B1)', () => {
  it('partial-only window with 3 words submits once, flagged lowConfidence', () => {
    startSession();
    voice().onPartial('tell me a story');
    voice().onEnd();
    expect(handlers.onUtterance).toHaveBeenCalledTimes(1);
    expect(handlers.onUtterance).toHaveBeenCalledWith('tell me a story', { lowConfidence: true });
    // The flushed window does not re-arm — the utterance took the final path.
    vi.advanceTimersByTime(REARM_MS * 3);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
  });

  it('a 1-word partial is not submitted; the window re-arms as before', () => {
    startSession();
    voice().onPartial('hmm');
    voice().onEnd();
    expect(handlers.onUtterance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('a final result arriving after the flush does not double submit', () => {
    startSession();
    voice().onPartial('tell me a story');
    voice().onEnd();
    expect(handlers.onUtterance).toHaveBeenCalledTimes(1);
    // Late final for the same (already-flushed) window is ignored.
    voice().onResult('tell me a story about a cat');
    expect(handlers.onUtterance).toHaveBeenCalledTimes(1);
  });

  it('a normal final still wins when it arrives before the window ends', () => {
    startSession();
    voice().onPartial('tell me a');
    voice().onResult('tell me a story');
    expect(handlers.onUtterance).toHaveBeenCalledWith('tell me a story');
    voice().onEnd();
    expect(handlers.onUtterance).toHaveBeenCalledTimes(1);
  });

  it('echo of the reply is not submitted (mayFlushPartial veto)', () => {
    // The session wires its echo-of-reply guard into this hook; here the veto
    // stands in for it so the wiring itself is proven.
    startSession({ mayFlushPartial: vi.fn(() => false) });
    voice().onPartial('the weather is');
    voice().onEnd();
    expect(handlers.onUtterance).not.toHaveBeenCalled();
    // A vetoed partial falls through to the normal re-arm path.
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('silent window (no partial at all) still re-arms as before', () => {
    startSession();
    voice().onEnd();
    expect(handlers.onUtterance).not.toHaveBeenCalled();
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('a partial is submitted once only across two window ends', () => {
    startSession();
    voice().onPartial('what is the time');
    voice().onEnd();
    // Engine delivers a second end for the same window (defensive) — no resubmit.
    voice().onEnd();
    expect(handlers.onUtterance).toHaveBeenCalledTimes(1);
  });
});
