import React, { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import AuthModal, { type AuthMode } from './AuthModal';
import { supabase } from '@api/supabase';
import useStore from '@store/store';
import { resolveTheme } from '@utils/theme';
import { chatOrigin, marketingOrigin } from '@utils/authRoutes';
import TechWaveBackground from '@components/Background/TechWaveBackground';

// Standalone auth page, shown on the auth.* subdomain (and /auth in dev) per
// the beta plan. Successful sign-in redirects to the chat app on the sibling
// chat.* host, or the site root when running locally.

// Supabase sessions live in per-origin localStorage, so a sign-in on auth.*
// cannot be read by chat.*. The session is handed over in the URL hash instead —
// the chat app's client has detectSessionInUrl enabled and stores it locally.
const sessionHash = (session: Session): string => {
  const params = new URLSearchParams();
  params.set('access_token', session.access_token);
  params.set('refresh_token', session.refresh_token);
  if (session.expires_in) params.set('expires_in', String(session.expires_in));
  if (session.expires_at) params.set('expires_at', String(session.expires_at));
  params.set('token_type', session.token_type ?? 'bearer');
  if (session.provider_token) params.set('provider_token', session.provider_token);
  if (session.provider_refresh_token)
    params.set('provider_refresh_token', session.provider_refresh_token);
  return params.toString();
};

const AuthPage = () => {
  const [ready, setReady] = useState(false);
  const [guestError, setGuestError] = useState<string | null>(null);
  const [sessionExpired] = useState<boolean>(() => new URLSearchParams(window.location.search).get('reason') === 'expired');
  const [mode, setMode] = useState<AuthMode>('signin');
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    resolveTheme(useStore.getState().theme)
  );
  const dark = theme === 'dark';

  const goToChat = (session?: Session | null, guest = false) => {
    const hash = session ? `#${sessionHash(session)}` : '';
    const resolved = resolveTheme(useStore.getState().theme);
    window.location.assign(`${chatOrigin()}/?theme=${resolved}${guest ? '&guest=1' : ''}${hash}`);
  };

  // Session guard: any existing session (signed-in or guest) skips this screen.
  // The session is passed along because chat.* cannot read auth.* localStorage.
  useEffect(() => {
    let cancelled = false;
    const guard = async () => {
      const session = supabase ? (await supabase.auth.getSession()).data.session : null;
      if (cancelled) return;
      // Guests stay on this screen (sign-in or "Continue as guest"); only signed-in accounts move on.
      if (session && !session.user.is_anonymous) return goToChat(session);
      setReady(true);
    };
    void guard();
    return () => {
      cancelled = true;
    };
  }, []);

  const continueAsGuest = () => {
    // The chat app creates the anonymous guest session when it sees ?guest=1.
    goToChat(null, true);
  };

  // App.tsx owns theme application in the chat app, but this page mounts
  // without App, so apply the same resolved .dark/.light class here and keep
  // it in state so the page surface follows the theme deterministically.
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(useStore.getState().theme);
      document.documentElement.className = resolved;
      setTheme(resolved);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  return (
    <div
      className={`relative flex h-[100dvh] w-full items-center justify-center overflow-hidden p-4 transition-colors lg:p-6 ${
        dark ? 'bg-zinc-950 text-zinc-100' : 'bg-white text-zinc-900'
      }`}
    >
      {dark && <TechWaveBackground />}
      <div className='relative z-10 flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-zinc-200 bg-white text-zinc-900 shadow-2xl backdrop-blur-xl lg:grid lg:h-[620px] lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)] dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-100'>
      <div className='relative hidden h-full overflow-hidden bg-zinc-950 p-6 text-white lg:flex lg:flex-col lg:justify-between lg:p-8'>
        <img
          src='/assets/Emerald%20Waveframe%20Tech%20Background.png'
          alt=''
          className='absolute inset-0 h-full w-full rounded-l-3xl object-cover'
        />
        <div className='absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-zinc-950/30 to-transparent' />
        <div className='relative flex items-center gap-4 text-xs font-semibold uppercase tracking-widest text-zinc-400'>
          <span>A Wise Quote</span>
          <span className='h-px w-24 bg-white/50' />
        </div>
        <div className='relative mb-12'>
          <h2 className='text-3xl font-bold leading-tight tracking-tight text-white'>Get Everything You Want</h2>
          <p className='mt-3 max-w-sm text-sm leading-relaxed text-zinc-300'>
            You can get everything you want if you work hard, trust the process, and stick to the plan.
          </p>
        </div>
      </div>
      <div className='relative flex h-full min-h-0 w-full flex-col items-center justify-between overflow-y-auto p-6 lg:p-8'>
        <div className='flex w-full flex-col items-center'>
        <div className='mb-4 flex h-12 items-center'>
          <img
            src={dark ? '/assets/brand/logo-sidebar-dark.png' : '/assets/brand/logo-sidebar-light.png'}
            alt='Pico logo'
            className='h-10 w-auto object-contain'
          />
        </div>
        <div className='mb-5 text-center'>
          <h1 className='font-serif text-3xl font-semibold text-zinc-900 dark:text-zinc-100'>
            {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
          </h1>
        </div>

        </div>

        <div className='flex w-full flex-1 items-center justify-center py-4'>
          {!ready ? (
            <div className='h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white' aria-label='Loading' />
          ) : (
            <div className='flex w-full flex-col'>
              {sessionExpired && (
                <p role='alert' className='mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'>
                  Session expired, please sign in.
                </p>
              )}
              <AuthModal embedded mode={mode} onModeChange={setMode} onSignedIn={goToChat} />
            </div>
          )}
        </div>

        <div className='flex w-full flex-col items-center'>
          {guestError && <p className='mb-3 text-sm text-red-500 dark:text-red-400'>{guestError}</p>}
          <p className='text-center text-sm text-zinc-600 dark:text-zinc-400'>
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              type='button'
              onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
              className='inline-flex min-h-[48px] items-center px-1 font-semibold text-zinc-900 hover:underline dark:text-white'
            >
              {mode === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
          <button
            type='button'
            onClick={() => {
              setGuestError(null);
              continueAsGuest();
            }}
            className='mt-2 inline-flex min-h-[48px] items-center px-3 text-sm font-medium text-zinc-700 underline-offset-4 transition-colors hover:text-zinc-900 hover:underline dark:text-zinc-300 dark:hover:text-white'
          >
            Continue as guest
          </button>
          <p className='mt-6 text-center text-xs leading-relaxed text-zinc-600 dark:text-zinc-400'>
            By continuing you agree to the{' '}
            <a className='inline-flex min-h-[48px] items-center underline hover:text-zinc-700 dark:hover:text-zinc-300' href={`${marketingOrigin()}/privacy.html`}>
              Privacy Policy
            </a>{' '}
            and{' '}
            <a className='inline-flex min-h-[48px] items-center underline hover:text-zinc-700 dark:hover:text-zinc-300' href={`${marketingOrigin()}/terms.html`}>
              Terms
            </a>
            .
          </p>
        </div>
      </div>
      </div>
    </div>
  );
};

export default AuthPage;
