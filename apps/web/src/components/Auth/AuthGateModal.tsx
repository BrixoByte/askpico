import React, { useState } from 'react';
import useAuthGateStore from '@store/auth-gate-store';
import { isNativeMobileApp } from '@utils/device';
import AuthModal, { type AuthMode } from './AuthModal';

// Native app: full-screen sign-in page instead of a floating popup. Web and
// mobile browsers keep the popup below.
const NativeAuthScreen = ({ onDone }: { onDone: () => void }) => {
  const [mode, setMode] = useState<AuthMode>('signin');

  return (
    <div className='dark fixed inset-0 z-[1000] flex flex-col overflow-y-auto bg-zinc-950 p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))] text-zinc-100' role='dialog' aria-modal='true'>
      <button
        type='button'
        onClick={onDone}
        aria-label='Back'
        className='absolute left-3 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:text-white'
      >
        <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-5 w-5' aria-hidden='true'>
          <path d='m15 18-6-6 6-6' />
        </svg>
      </button>
      <div className='my-auto flex w-full flex-col items-center'>
        <img src='/assets/brand/logo.png' alt='Pico' className='mb-4 h-20 w-20 object-contain' />
        <h1 className='font-serif text-3xl font-semibold'>
          {mode === 'signin' ? 'Welcome Back' : 'Create Account'}
        </h1>
        <p className='mb-6 mt-2 text-center text-sm text-zinc-400'>
          Keep your chats and memory across devices.
        </p>
        <AuthModal embedded mode={mode} onModeChange={setMode} onSignedIn={onDone} />
        <p className='mt-6 text-center text-sm text-zinc-400'>
          {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type='button'
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
            className='font-semibold text-white hover:underline'
          >
            {mode === 'signin' ? 'Sign Up' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  );
};

// Sign-in prompt for gated features. Signing in happens in place: the anonymous
// session is replaced on this origin, so chats and settings stay where they are.
const AuthGateModal = () => {
  const message = useAuthGateStore((state) => state.message);
  const close = useAuthGateStore((state) => state.close);
  const [signingIn, setSigningIn] = useState<boolean>(false);

  if (!message) return null;

  const dismiss = () => {
    setSigningIn(false);
    close();
  };

  if (isNativeMobileApp()) return <NativeAuthScreen onDone={dismiss} />;

  if (signingIn) return <AuthModal onClose={dismiss} onSignedIn={dismiss} />;

  return (
    <div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm' role='dialog' aria-modal='true'>
      <div className='w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl'>
        <h2 className='text-lg font-semibold text-ink'>Sign in to continue</h2>
        <p className='mt-2 text-sm text-ink-muted'>{message}</p>
        <p className='mt-2 text-xs text-ink-muted'>
          Free accounts keep your chats and memory across devices, and unlock images and file uploads.
        </p>
        <div className='mt-5 flex justify-end gap-2'>
          <button
            type='button'
            onClick={dismiss}
            className="relative rounded-xl px-4 py-2 text-sm font-medium text-ink-soft hover:bg-ink/5 after:absolute after:-inset-y-1.5 after:content-['']"
          >
            Not now
          </button>
          <button
            type='button'
            onClick={() => setSigningIn(true)}
            className="relative rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 after:absolute after:-inset-y-1.5 after:content-['']"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
};

export default AuthGateModal;
