import { describe, expect, it, vi, afterEach } from 'vitest';

vi.mock('@api/supabase', () => ({ supabase: null, ensureSession: async () => false }));

import { authUrl, chatOrigin, resetRedirectUrl } from './authRoutes';

const setLocation = (href: string) => {
  const url = new URL(href);
  vi.stubGlobal('window', {
    location: { protocol: url.protocol, hostname: url.hostname, port: url.port, pathname: url.pathname },
  });
};

describe('hosted app origin and password reset redirect', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses go.askpico.app as the sign-in hand-off from auth.* (no chat.* host)', () => {
    setLocation('https://auth.askpico.app/');
    expect(chatOrigin()).toBe('https://go.askpico.app');
    expect(resetRedirectUrl()).toBe('https://go.askpico.app/');
  });

  it('uses go.askpico.app from any production host', () => {
    for (const host of ['https://go.askpico.app/', 'https://askpico.app/']) {
      setLocation(host);
      expect(chatOrigin()).toBe('https://go.askpico.app');
      expect(resetRedirectUrl()).toBe('https://go.askpico.app/');
    }
  });

  it('keeps the local origin and port on local dev', () => {
    setLocation('http://localhost:5173/auth');
    expect(chatOrigin()).toBe('http://localhost:5173');
    expect(resetRedirectUrl()).toBe('http://localhost:5173/');
  });

  it('sign-in route is /auth', () => {
    expect(authUrl()).toBe('/auth');
  });
});
