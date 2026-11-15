import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { isNativeMobileApp } from '@utils/device';
import { openAppSettings } from '@utils/nativeAgent';

type Props = {
  onCheckAgain: () => void;
};

const STEP_COUNT = 3;

const STEP_TEXT = [
  "Step 1: Click the security lock icon (🔒) on the left side of your browser's address bar.",
  "Step 2: Locate 'Microphone' in the drop-down menu that appears.",
  "Step 3: Switch from 'Block' to 'Allow', then click 'Check again' to launch JARVIS voice mode.",
];

const LockIcon = () => (
  <svg viewBox='0 0 24 24' className='h-4 w-4' fill='none' stroke='currentColor' strokeWidth='2' aria-hidden='true'>
    <rect x='5' y='11' width='14' height='10' rx='2' />
    <path d='M8 11V7a4 4 0 0 1 8 0v4' />
  </svg>
);

const AddressBarScene = () => (
  <div className='flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5'>
    <span className='flex h-8 w-8 animate-pulse items-center justify-center rounded-full bg-[#9EFF00]/20 text-[#9EFF00] ring-2 ring-[#9EFF00]'>
      <LockIcon />
    </span>
    <span className='text-sm text-zinc-400'>chat.localhost:5173</span>
  </div>
);

const PermissionsScene = () => (
  <div className='space-y-1 rounded-xl border border-zinc-800 bg-zinc-950 p-2 text-sm'>
    <div className='flex items-center justify-between rounded-lg px-3 py-2 text-zinc-400'>
      <span>Cookies and site data</span>
      <span>›</span>
    </div>
    <div className='flex items-center justify-between rounded-lg bg-[#9EFF00]/10 px-3 py-2 text-zinc-100 ring-1 ring-[#9EFF00]/60'>
      <span>Microphone</span>
      <span className='rounded-md border border-zinc-700 px-2 py-0.5 text-xs text-zinc-300'>Block ▾</span>
    </div>
  </div>
);

const AllowScene = () => (
  <div className='flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm'>
    <span className='text-zinc-100'>Microphone</span>
    <div className='flex overflow-hidden rounded-lg border border-zinc-700 text-xs font-medium'>
      <span className='px-3 py-1.5 text-zinc-500'>Block</span>
      <span className='bg-[#9EFF00] px-3 py-1.5 text-black ring-2 ring-[#9EFF00]'>Allow</span>
    </div>
  </div>
);

const SCENES = [AddressBarScene, PermissionsScene, AllowScene];

const MicOnboardingModal = ({ onCheckAgain }: Props) => {
  const [step, setStep] = useState(1);
  const Scene = SCENES[step - 1];
  const isLast = step === STEP_COUNT;

  if (isNativeMobileApp()) {
    return createPortal(
      <div className='fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm'>
        <div
          role='dialog'
          aria-modal='true'
          aria-labelledby='mic-onboarding-title'
          className='w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl transition-colors dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
        >
          <div className='mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#9EFF00]/15 text-[#84cc16] dark:text-[#9EFF00]'>
            <svg viewBox='0 0 24 24' className='h-8 w-8' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
              <rect x='9' y='2' width='6' height='12' rx='3' />
              <path d='M5 10v1a7 7 0 0 0 14 0v-1' />
              <line x1='12' y1='18' x2='12' y2='22' />
              <line x1='2' y1='2' x2='22' y2='22' />
            </svg>
          </div>
          <h2 id='mic-onboarding-title' className='text-center text-xl font-bold tracking-tight'>
            Microphone Permission Disabled
          </h2>
          <p className='mt-2 text-center text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'>
            Microphone access is turned off for Pico in your system settings. Please enable microphone permissions to use Voice Mode.
          </p>
          <div className='mt-6 flex flex-col gap-3'>
            <button
              type='button'
              onClick={openAppSettings}
              className='w-full rounded-2xl bg-[#9EFF00] py-3.5 font-semibold text-zinc-950 shadow-[0_0_20px_rgba(158,255,0,0.2)] transition-all hover:bg-[#8ee000]'
            >
              Open Settings
            </button>
            <button
              type='button'
              onClick={onCheckAgain}
              className='w-full rounded-2xl border border-zinc-200 bg-zinc-100 py-3 text-sm font-medium text-zinc-800 transition-all hover:bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800'
            >
              Try Again
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className='fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='mic-onboarding-title'
        className='w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl'
      >
        <div className='flex items-center justify-between'>
          <h2 id='mic-onboarding-title' className='text-lg font-semibold text-zinc-100'>
            Microphone access is blocked
          </h2>
          <div className='flex items-center gap-1.5' aria-label={`Step ${step} of ${STEP_COUNT}`}>
            {Array.from({ length: STEP_COUNT }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i + 1 === step ? 'w-5 bg-[#9EFF00]' : 'w-1.5 bg-zinc-700'
                }`}
              />
            ))}
          </div>
        </div>

        <div className='mt-5 space-y-4'>
          <Scene />
          <p className='text-sm leading-relaxed text-zinc-300'>{STEP_TEXT[step - 1]}</p>
        </div>

        <div className='mt-6 flex items-center justify-end gap-2'>
          <div className='flex gap-2'>
            <button
              type='button'
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className='rounded-full border border-zinc-800 px-4 py-1.5 text-sm text-zinc-400 transition-colors hover:bg-zinc-800 disabled:opacity-40'
            >
              Back
            </button>
            {isLast ? (
              <button
                type='button'
                onClick={onCheckAgain}
                className='rounded-full bg-[#9EFF00] px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90'
              >
                Check again
              </button>
            ) : (
              <button
                type='button'
                onClick={() => setStep((s) => Math.min(STEP_COUNT, s + 1))}
                className='rounded-full bg-[#9EFF00] px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90'
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MicOnboardingModal;
