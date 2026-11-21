// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase', () => ({ getAccessToken: async () => null }));
vi.mock('@store/store', () => ({ default: { getState: () => ({ replyLanguage: 'en' }) } }));

import { getChatCompletionStream } from './api';

const respondWith = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
  );

const send = () => getChatCompletionStream([{ role: 'user', content: 'hi' } as never]);

const failureMessage = async () => {
  try {
    await send();
    return '';
  } catch (err) {
    return (err as Error).message;
  }
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('chat 429 responses', () => {
  it('daily quota 429 is reported as QUOTA_EXHAUSTED, not as busy or rate limited', async () => {
    respondWith(429, { error: 'QUOTA_EXHAUSTED', message: 'Daily token limit reached.', tokensUsed: 10500, tokenLimit: 10000 });
    expect(await failureMessage()).toBe('QUOTA_EXHAUSTED');
  });

  it('upstream busy 429 still shows the busy message', async () => {
    respondWith(429, { error: 'Service is busy. Please try again.', code: 'UPSTREAM_BUSY' });
    expect(await failureMessage()).toBe('Service is busy. Please try again.');
  });

  it('other 429 responses keep the rate-limit marker', async () => {
    respondWith(429, { error: 'Too many requests' });
    expect(await failureMessage()).toContain('Rate limited!');
  });
});
