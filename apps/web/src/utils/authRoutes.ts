import { ensureSession, supabase } from '@api/supabase';

// The Auth screen lives on the auth.* sibling of chat.*, or at /auth on local dev
// (same origin, which the PicoApp WebView also uses).
export const authUrl = (): string => {
  const { protocol, hostname, port } = window.location;
  return hostname.startsWith('chat.')
    ? `${protocol}//auth.${hostname.slice(5)}${port ? `:${port}` : ''}/`
    : '/auth';
};

// Splash gate: any session (guest or signed-in) opens chat. No session goes to the
// Auth screen, except the guest hand-off ("?guest=1") which creates the anonymous
// session on this origin.
export const enterChat = async (): Promise<boolean> => {
  if (!supabase) return true;
  const { data } = await supabase.auth.getSession();
  if (data.session) return true;
  const url = new URL(window.location.href);
  if (url.searchParams.has('guest') && (await ensureSession())) {
    url.searchParams.delete('guest');
    window.history.replaceState(window.history.state, '', url.toString());
    return true;
  }
  window.location.replace(authUrl());
  return false;
};
