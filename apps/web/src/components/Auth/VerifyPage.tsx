import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@api/supabase';
import { authUrl } from '@utils/authRoutes';
import { isNativeMobileApp } from '@utils/device';
import { readVerifyCode, readVerifyParams, VERIFY_TIMEOUT_MS, withTimeout } from '@utils/verifyLink';
import ResetPasswordModal from './ResetPasswordModal';

// Email links point here: https://go.askpico.app/verify?token_hash=...&type=signup|recovery
// Inside the Android app the link is verified automatically; in a browser the user
// presses "Verify email". Signup ends at sign-in; recovery opens the new-password form.

type Status = 'ready' | 'verifying' | 'signup-done' | 'recovery' | 'error';

const card = 'w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900';
const primary = 'mt-5 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60';

const VerifyPage = () => {
  const initial = readVerifyParams(window.location.search);
  const pkceCode = readVerifyCode(window.location.search);
  const hasTokenHash = Boolean(initial.tokenHash && initial.type);
  const complete = hasTokenHash || Boolean(pkceCode);
  const [status, setStatus] = useState<Status>(complete ? 'ready' : 'error');
  const [error, setError] = useState<string | null>(
    complete ? null : 'This link is incomplete. Request a new email from the sign-in page.'
  );
  const started = useRef(false);
  const native = isNativeMobileApp();

  const verify = async () => {
    if (started.current || !supabase) return;
    started.current = true;
    setStatus('verifying');
    setError(null);
    window.history.replaceState(null, '', '/verify');
    try {
      if (pkceCode && !hasTokenHash) {
        // PKCE (?code=...) link: exchange it; Supabase emits PASSWORD_RECOVERY for
        // recovery flows, SIGNED_IN otherwise. Fails cleanly when the code
        // verifier is not in this browser's storage.
        let recovery = false;
        const { data: sub } = supabase.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') recovery = true;
        });
        const { error: codeError } = await withTimeout(supabase.auth.exchangeCodeForSession(pkceCode), VERIFY_TIMEOUT_MS);
        sub.subscription.unsubscribe();
        if (codeError) {
          setStatus('error');
          setError('This link is invalid or has expired. Request a new one from the sign-in page.');
          return;
        }
        if (recovery) return setStatus('recovery');
        await withTimeout(supabase.auth.signOut({ scope: 'local' }), VERIFY_TIMEOUT_MS).catch(() => {});
        setStatus('signup-done');
        return;
      }
      if (!initial.tokenHash || !initial.type) {
        setStatus('error');
        setError('This link is incomplete. Request a new email from the sign-in page.');
        return;
      }
      const { error: otpError } = await withTimeout(
        supabase.auth.verifyOtp({ token_hash: initial.tokenHash, type: initial.type }),
        VERIFY_TIMEOUT_MS
      );
      if (otpError) {
        setStatus('error');
        setError('This link is invalid or has already been used. Request a new one from the sign-in page.');
        return;
      }
      if (initial.type === 'recovery') return setStatus('recovery');
      await withTimeout(supabase.auth.signOut({ scope: 'local' }), VERIFY_TIMEOUT_MS).catch(() => {});
      setStatus('signup-done');
    } catch (e) {
      setStatus('error');
      setError(
        e instanceof Error && e.message === 'timeout'
          ? 'Verification timed out. Check your connection and try again.'
          : 'This link is invalid or has expired. Request a new one from the sign-in page.'
      );
    }
  };

  const retry = () => {
    started.current = false;
    void verify();
  };

  useEffect(() => {
    if (native && complete) void verify();
  }, []);

  // supabase-js may auto-exchange a ?code= link during client init (when the
  // verifier exists); catch the PASSWORD_RECOVERY event it emits.
  useEffect(() => {
    if (!supabase || !pkceCode) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('recovery');
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (status === 'recovery') {
    return <ResetPasswordModal onClose={() => window.location.assign('/')} />;
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950'>
      <div role='status' className={card}>
        {status === 'error' && (
          <>
            <h1 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Link not valid</h1>
            <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>{error}</p>
            <button type='button' className={primary} onClick={retry}>
              Try again
            </button>
            <button
              type='button'
              className='mt-2 w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              onClick={() => window.location.assign(authUrl())}
            >
              Go to sign in
            </button>
          </>
        )}
        {status === 'ready' && (
          <>
            <h1 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Verify your email</h1>
            <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>Press the button to confirm this email address.</p>
            <button type='button' className={primary} onClick={verify}>
              Verify email
            </button>
          </>
        )}
        {status === 'verifying' && (
          <p className='text-sm text-zinc-600 dark:text-zinc-400'>Verifying…</p>
        )}
        {status === 'signup-done' && (
          <>
            <h1 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>Email verified</h1>
            <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>Your account is ready. Sign in to continue.</p>
            <button type='button' className={primary} onClick={() => window.location.assign(authUrl())}>
              Sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyPage;
