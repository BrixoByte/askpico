import { describe, expect, it, vi, afterEach } from 'vitest';
import { classifyEmailLink, readVerifyCode, readVerifyParams } from '@utils/verifyLink';

describe('verify link params', () => {
  it('reads token_hash and a known type', () => {
    expect(readVerifyParams('?token_hash=abc123&type=signup')).toEqual({ tokenHash: 'abc123', type: 'signup' });
    expect(readVerifyParams('?token_hash=abc123&type=recovery')).toEqual({ tokenHash: 'abc123', type: 'recovery' });
  });

  it('rejects unknown types and missing tokens', () => {
    expect(readVerifyParams('?token_hash=abc&type=admin')).toEqual({ tokenHash: 'abc', type: null });
    expect(readVerifyParams('?type=signup')).toEqual({ tokenHash: null, type: 'signup' });
    expect(readVerifyParams('')).toEqual({ tokenHash: null, type: null });
  });

  it('reads a PKCE code', () => {
    expect(readVerifyCode('?code=pkce-123')).toBe('pkce-123');
    expect(readVerifyCode('?token_hash=abc&type=recovery')).toBeNull();
  });
});

describe('email link safety net (off-route links)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('routes a recovery token_hash arriving on / to the verify flow', () => {
    expect(classifyEmailLink('/', '?token_hash=abc123&type=recovery', '')).toBe('verify-params');
  });

  it('routes a signup token_hash arriving on / the same way', () => {
    expect(classifyEmailLink('/', '?token_hash=abc123&type=signup', '')).toBe('verify-params');
  });

  it('routes token_hash links on other non-verify routes too', () => {
    expect(classifyEmailLink('/auth', '?token_hash=abc&type=recovery', '')).toBe('verify-params');
    expect(classifyEmailLink('/some/page', '?token_hash=abc&type=recovery', '')).toBe('verify-params');
  });

  it('leaves /verify itself alone', () => {
    expect(classifyEmailLink('/verify', '?token_hash=abc&type=recovery', '')).toBe('none');
  });

  it('treats a normal visit to / as none', () => {
    expect(classifyEmailLink('/', '', '')).toBe('none');
    expect(classifyEmailLink('/', '?ref=friend', '')).toBe('none');
    expect(classifyEmailLink('/', '', '#section')).toBe('none');
  });

  it('ignores malformed or unknown-type links', () => {
    expect(classifyEmailLink('/', '?token_hash=abc&type=bogus', '')).toBe('none');
    expect(classifyEmailLink('/', '?type=recovery', '')).toBe('none');
  });

  it('detects an implicit recovery hash and leaves it to supabase-js', () => {
    expect(classifyEmailLink('/', '', '#access_token=tok&refresh_token=r&expires_in=3600&type=recovery')).toBe(
      'implicit-hash'
    );
    expect(classifyEmailLink('/', '', '#access_token=tok&type=signup')).toBe('none');
  });

  it('routes a ?code= link with no PKCE verifier to the verify flow (clear error)', () => {
    // node test env has no localStorage -> verifier absent
    expect(classifyEmailLink('/', '?code=abc123', '')).toBe('pkce-code');
  });

  it('leaves a ?code= link alone when a PKCE verifier exists (supabase-js auto-exchange)', () => {
    const store: Record<string, string> = { 'sb-project-auth-token-code-verifier': 'verifier' };
    vi.stubGlobal('localStorage', {
      get length() {
        return Object.keys(store).length;
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      getItem: (k: string) => store[k] ?? null,
    });
    expect(classifyEmailLink('/', '?code=abc123', '')).toBe('none');
  });
});
