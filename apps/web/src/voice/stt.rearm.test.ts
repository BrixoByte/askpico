// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@utils/device', () => ({ isNativeMobileApp: () => true }));
vi.mock('@utils/speech', () => ({ speechRecognitionSupported: () => false }));
vi.mock('@utils/logger', () => ({
  PicoLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
}));

import { PicoLogger } from '@utils/logger';
import { ANDROID_REARM_CAP_MESSAGE, SpeechInput } from './stt';

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

const startSession = () => {
  input = new SpeechInput();
  handlers = {
    onError: vi.fn(),
    onUtterance: vi.fn(),
    onPartial: vi.fn(),
    onSpeechStart: vi.fn(),
  };
  input.start(handlers as never, { lang: 'en-US' });
};

// One listening window that hears partial speech but ends without a final result.
const partialOnlyWindow = () => {
  voice().onPartial('what time');
  voice().onEnd();
  vi.advanceTimersByTime(REARM_MS);
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

describe('Android voice re-arm (H1 + H8)', () => {
  it('re-arms exactly once after the cooldown when a window ends with no speech', () => {
    startSession();
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
    voice().onEnd();
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
    expect(native().startVoiceInput).toHaveBeenLastCalledWith('en-US');
  });

  it('re-arms after a partial-only window (speech heard, no final result)', () => {
    startSession();
    voice().onPartial('what time');
    voice().onEnd();
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('re-arms after a speech-start window that ends with no final result', () => {
    startSession();
    voice().onSpeechStart();
    voice().onEnd();
    vi.advanceTimersByTime(REARM_MS);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(2);
  });

  it('caps at 3 re-arms per session and then stops', () => {
    startSession();
    for (let i = 0; i < 3; i++) partialOnlyWindow();
    expect(native().startVoiceInput).toHaveBeenCalledTimes(4);

    voice().onPartial('what time');
    voice().onEnd();
    vi.advanceTimersByTime(REARM_MS * 5);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(4);
    expect(PicoLogger.info).toHaveBeenCalledWith(
      'STT',
      expect.stringContaining('Re-arm cap reached'),
      expect.objectContaining({ max: 3 })
    );
  });

  it('shows the "Voice stopped. Tap to try again." message at the cap', () => {
    startSession();
    for (let i = 0; i < 3; i++) partialOnlyWindow();
    expect(handlers.onError).not.toHaveBeenCalled();

    voice().onEnd();
    expect(ANDROID_REARM_CAP_MESSAGE).toBe('Voice stopped. Tap to try again.');
    expect(handlers.onError).toHaveBeenCalledWith('Voice stopped. Tap to try again.', false);
  });

  it('resets the counter only on a final result', () => {
    startSession();
    partialOnlyWindow();
    partialOnlyWindow();
    const s = input as unknown as { androidRearms: number };
    expect(s.androidRearms).toBe(2);

    voice().onPartial('what time is it');
    expect(s.androidRearms).toBe(2);

    voice().onResult('what time is it in Multan');
    expect(s.androidRearms).toBe(0);
    expect(handlers.onUtterance).toHaveBeenCalledWith('what time is it in Multan');
  });

  it('does not re-arm after a final result closes the window', () => {
    startSession();
    voice().onResult('hello pico');
    voice().onEnd();
    vi.advanceTimersByTime(REARM_MS * 3);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
    expect(handlers.onError).not.toHaveBeenCalled();
  });

  it('does not re-arm after the user stops listening', () => {
    startSession();
    input!.stop();
    voice().onEnd();
    vi.advanceTimersByTime(REARM_MS * 3);
    expect(native().startVoiceInput).toHaveBeenCalledTimes(1);
  });
});
