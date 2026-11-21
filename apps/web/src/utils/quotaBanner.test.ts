// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../api/supabase', () => ({ getAccessToken: async () => null }));
vi.mock('@store/store', () => ({ default: { getState: () => ({ replyLanguage: 'en' }) } }));

import { getChatCompletionStream } from '../api/api';
import { QUOTA_DISMISS_KEY, quotaDismissedRecently, quotaKindForError } from './quotaBanner';

const respondWith = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  );

const failureMessage = async () => {
  try {
    await getChatCompletionStream([{ role: 'user', content: 'hi' } as never]);
    return '';
  } catch (err) {
    return (err as Error).message;
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('quotaKindForError', () => {
  it('maps the QUOTA_EXHAUSTED code to the daily-limit (cap) banner', async () => {
    respondWith(429, { error: 'QUOTA_EXHAUSTED', message: 'Daily token limit reached.', tokensUsed: 10500, tokenLimit: 10000 });
    const message = await failureMessage();
    expect(message).toBe('QUOTA_EXHAUSTED');
    expect(quotaKindForError(message)).toBe('cap');
  });

  it('prefers the explicit quota code when a message also contains the rate-limit marker', () => {
    expect(quotaKindForError('QUOTA_EXHAUSTED\nRate limited!')).toBe('cap');
  });

  it('maps a plain rate-limit 429 to the busy banner', async () => {
    respondWith(429, { error: 'Too many requests. Please wait a minute and try again.' });
    const message = await failureMessage();
    expect(message).toContain('Rate limited!');
    expect(quotaKindForError(message)).toBe('busy');
  });

  it('maps guest and request cap bodies to the cap banner', async () => {
    for (const message of [
      'Free guest limit reached for today. Sign in to keep chatting.',
      'Daily request cap reached. Your quota resets at midnight UTC.',
    ]) {
      respondWith(429, { error: 'QUOTA_EXHAUSTED', message });
      expect(quotaKindForError(await failureMessage())).toBe('cap');
    }
  });

  it('returns null for UPSTREAM_BUSY so it stays on the inline error path', async () => {
    respondWith(429, { error: 'Service is busy. Please try again.', code: 'UPSTREAM_BUSY' });
    const message = await failureMessage();
    expect(message).toBe('Service is busy. Please try again.');
    expect(quotaKindForError(message)).toBeNull();
  });

  it('returns null for unrelated errors', () => {
    expect(quotaKindForError('Connection to Pico was lost while generating.')).toBeNull();
  });
});

describe('quotaDismissedRecently', () => {
  it('is false when the banner was never dismissed', () => {
    expect(quotaDismissedRecently()).toBe(false);
  });

  it('is true right after a dismissal and false after the 7-day window', () => {
    const now = Date.now();
    localStorage.setItem(QUOTA_DISMISS_KEY, String(now));
    expect(quotaDismissedRecently(now + 1000)).toBe(true);
    expect(quotaDismissedRecently(now + 8 * 24 * 60 * 60 * 1000)).toBe(false);
  });
});
