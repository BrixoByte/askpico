import { describe, expect, it } from 'vitest';
import { decideStartRoute } from './startRoute';

const base = { session: null, storedSession: false, online: true, checkFailed: false };

describe('decideStartRoute', () => {
  it('signed-out, nothing stored -> auth', () => {
    expect(decideStartRoute(base)).toBe('auth');
  });

  it('signed-in session -> chat, no auth', () => {
    expect(decideStartRoute({ ...base, session: { isAnonymous: false }, storedSession: true })).toBe('chat');
  });

  it('existing guest (anonymous) session -> chat', () => {
    expect(decideStartRoute({ ...base, session: { isAnonymous: true }, storedSession: true })).toBe('chat');
  });

  it('expired stored session while online -> auth with expired message', () => {
    expect(decideStartRoute({ ...base, storedSession: true })).toBe('auth-expired');
  });

  it('offline with stored session -> chat, no logout', () => {
    expect(decideStartRoute({ ...base, storedSession: true, online: false })).toBe('chat');
  });

  it('check failed or timed out with stored session -> chat, no logout', () => {
    expect(decideStartRoute({ ...base, storedSession: true, checkFailed: true })).toBe('chat');
  });

  it('sign-out (no stored session) never routes to chat', () => {
    expect(decideStartRoute({ ...base, online: false, checkFailed: true })).toBe('auth');
  });
});
