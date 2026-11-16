import { createGuestSession, supabase } from '@api/supabase';
import { decideStartRoute } from './startRoute';

// The hosted app is go.askpico.app (chat.askpico.app has no DNS). Both constants can be
// overridden at build time; the defaults are the production values.
const APP_ORIGIN = import.meta.env.VITE_APP_ORIGIN || 'https://go.askpico.app';
// Password-reset links must land here: the app mounts /verify and handles PASSWORD_RECOVERY.
// This exact URL must be listed in Supabase Authentication > URL Configuration > Redirect URLs.
const RESET_REDIRECT_URL = import.meta.env.VITE_RESET_REDIRECT_URL || `${APP_ORIGIN}/`;

const isProductionHost = (hostname: string) =>
  hostname === 'askpico.app' || hostname.endsWith('.askpico.app');

const localOrigin = () => {
  const { protocol, hostname, port } = window.location;
  return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
};

// Sign-in hand-off target: the hosted app. Local dev keeps its own origin.
export const chatOrigin = (): string => (isProductionHost(window.location.hostname) ? APP_ORIGIN : localOrigin());

export const resetRedirectUrl = (): string =>
  isProductionHost(window.location.hostname) ? RESET_REDIRECT_URL : `${localOrigin()}/`;

export const authUrl = (): string => '/auth';

// Splash gate: decides the start route once the stored session is read (timeout
// about 3 s). Chat opens for any session, guest or signed-in; a guest is never sent
// away from chat. The only guest creation is the explicit ?guest=1 hand-off.
const SESSION_TIMEOUT_MS = 3000;
const hasStoredSession = () => Object.keys(localStorage).some((key) => /^sb-.+-auth-token$/.test(key));

export const enterChat = async (): Promise<boolean> => {
  if (!supabase) return true;
  const url = new URL(window.location.href);
  if (url.searchParams.has('guest')) {
    const guest = await createGuestSession();
    url.searchParams.delete('guest');
    window.history.replaceState(window.history.state, '', url.toString());
    if (guest) return true;
  }
  const stored = hasStoredSession();
  const check = supabase.auth
    .getSession()
    .then(({ data, error }) => ({ session: data.session, checkFailed: !!error }))
    .catch(() => ({ session: null, checkFailed: true }));
  const timeout = new Promise<{ session: null; checkFailed: true }>((resolve) =>
    setTimeout(() => resolve({ session: null, checkFailed: true }), SESSION_TIMEOUT_MS)
  );
  const result = await Promise.race([check, timeout]);
  const route = decideStartRoute({
    session: result.session ? { isAnonymous: !!result.session.user.is_anonymous } : null,
    storedSession: stored,
    online: navigator.onLine,
    checkFailed: result.checkFailed,
  });
  if (route === 'chat') return true;
  window.location.replace(route === 'auth-expired' ? `${authUrl()}?reason=expired` : authUrl());
  return false;
};
