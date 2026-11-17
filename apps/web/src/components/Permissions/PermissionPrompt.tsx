import React, { useEffect, useState } from 'react';
import { MicIcon } from '@icon/ui';

const PROMPTED_KEY = 'pico-permissions-prompted';

// Microphone explanation shown when the user starts voice (never at launch). It appears
// before the browser's native permission dialog; "Allow Access" calls getUserMedia so
// the browser asks for the microphone, then voice starts (pico:mic-granted).
const PermissionPrompt = () => {
  const [open, setOpen] = useState<boolean>(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener('pico:mic-prompt', show);
    return () => window.removeEventListener('pico:mic-prompt', show);
  }, []);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const finish = () => {
    try {
      localStorage.setItem(PROMPTED_KEY, '1');
    } catch {
      /* ignore storage failures */
    }
    setOpen(false);
  };

  const allow = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Microphone is not supported in this browser.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      finish();
      window.dispatchEvent(new Event('pico:mic-granted'));
    } catch (err: unknown) {
      const name = (err as DOMException).name;
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        finish();
        window.dispatchEvent(new Event('pico:mic-denied'));
        return;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className='fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-labelledby='permission-prompt-title'
    >
      <div className='relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#0B0F0E]/85 p-6 text-center shadow-[0_0_60px_rgba(158,255,0,0.12)] backdrop-blur-xl'>
        <div
          aria-hidden='true'
          className='pointer-events-none absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgba(45,212,191,0.22),transparent_70%),radial-gradient(50%_40%_at_100%_100%,rgba(16,185,129,0.16),transparent_70%)]'
        />
        <div className='relative mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[#9EFF00]/40 bg-[#9EFF00]/10 text-[#9EFF00] shadow-[0_0_24px_rgba(158,255,0,0.35)]'>
          <MicIcon className='h-7 w-7' />
        </div>
        <h2 id='permission-prompt-title' className='relative text-lg font-semibold text-white'>
          Enable microphone access
        </h2>
        <p className='relative mt-2 text-sm text-zinc-400'>
          Allow microphone access to enable voice typing and audio commands with PICO AI.
        </p>
        {error && <p className='relative mt-3 text-xs text-red-400'>{error}</p>}
        <div className='relative mt-6 flex flex-col gap-2'>
          <button
            type='button'
            onClick={allow}
            disabled={busy}
            className='w-full rounded-xl bg-[#9EFF00] px-4 py-2.5 text-sm font-semibold text-[#0B0F0E] transition-opacity hover:opacity-90 disabled:opacity-60'
          >
            {busy ? 'Requesting...' : 'Allow Access'}
          </button>
          <button
            type='button'
            onClick={finish}
            className='w-full rounded-xl px-4 py-2 text-sm font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white'
          >
            Not Now
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionPrompt;
