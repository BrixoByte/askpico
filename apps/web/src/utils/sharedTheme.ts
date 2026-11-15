import useStore from '@store/store';
import { Theme } from '@type/theme';
import { resolveTheme } from '@utils/theme';
import { isSignedInSession, supabase } from '@api/supabase';
import { fetchRemoteTheme, saveRemoteTheme } from '@api/preferences';

// Cross-subdomain theme sync. localStorage is per-origin, so the theme travels
// two ways: a root-domain cookie in production (.askpico.app) and a `theme`
// query param on the sign-in / launch links (works on localhost too).
const COOKIE = 'theme';
const PARAM = 'theme';
const VALID: Theme[] = ['light', 'dark', 'system'];

const isValid = (value: string | null): value is Theme =>
  value !== null && (VALID as string[]).includes(value);

const cookieDomain = () => {
  const host = window.location.hostname;
  return host === 'askpico.app' || host.endsWith('.askpico.app') ? '; Domain=.askpico.app' : '';
};

const readCookie = (): Theme | null => {
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark|system)/);
  return match && isValid(match[1]) ? (match[1] as Theme) : null;
};

const writeCookie = (theme: Theme) => {
  document.cookie = `${COOKIE}=${theme}${cookieDomain()}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

const STORAGE_KEY = 'pico_theme';

const readStored = (): Theme | null => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return isValid(value) ? value : null;
  } catch {
    return null;
  }
};

const writeStored = (theme: Theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore: storage can be unavailable in private modes
  }
};

const persistTheme = (theme: Theme) => {
  writeCookie(theme);
  writeStored(theme);
};

// Reads ?theme= from the URL and removes it so it does not linger in the address bar.
const consumeUrlTheme = (): Theme | null => {
  const url = new URL(window.location.href);
  const value = url.searchParams.get(PARAM);
  if (value === null) return null;
  url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, '', url.toString());
  return isValid(value) ? value : null;
};

const applyDocumentTheme = (theme: Theme) => {
  document.documentElement.className = resolveTheme(theme);
};

let signedIn = false;
let applyingRemote = false;

const pushRemoteTheme = (theme: Theme) => {
  if (!signedIn || applyingRemote) return;
  saveRemoteTheme(theme).catch(() => {
    // ignore: the cookie and localStorage already hold the choice on this device
  });
};

// Signed-in users: the DB preference wins on sign-in, so the theme follows
// the account across every subdomain and device. Guests keep the cookie.
const syncRemoteTheme = async () => {
  signedIn = await isSignedInSession();
  if (!signedIn) return;
  try {
    const remote = await fetchRemoteTheme();
    if (remote && isValid(remote) && remote !== useStore.getState().theme) {
      applyingRemote = true;
      useStore.getState().setTheme(remote);
      applyingRemote = false;
    } else if (!remote) {
      pushRemoteTheme(useStore.getState().theme);
    }
  } catch {
    // ignore: fall back to the locally stored theme
  }
};

// Runs before React renders so the first paint already uses the right palette.
export const initSharedTheme = () => {
  const incoming = consumeUrlTheme() ?? readCookie() ?? readStored();
  if (incoming && incoming !== useStore.getState().theme) {
    useStore.getState().setTheme(incoming);
  }
  applyDocumentTheme(useStore.getState().theme);
  persistTheme(useStore.getState().theme);

  useStore.subscribe((state, prev) => {
    if (state.theme === prev.theme) return;
    persistTheme(state.theme);
    pushRemoteTheme(state.theme);
  });

  void syncRemoteTheme();
  supabase?.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN') void syncRemoteTheme();
  });
};
