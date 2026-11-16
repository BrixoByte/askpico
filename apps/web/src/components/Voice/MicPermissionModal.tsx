import React from 'react';
import { createPortal } from 'react-dom';
import { isNativeMobileApp } from '@utils/device';

type Props = {
  onAllow: () => void;
  onDismiss: () => void;
};

// Native app: theme-aware card with a single primary action. Web browsers keep
// the original card and the secondary "Use text instead" button.
const MicPermissionModal = ({ onAllow, onDismiss }: Props) => {
  const native = isNativeMobileApp();

  return createPortal(
    <div className='fade-in fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='mic-permission-title'
        className={
          native
            ? 'relative w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 text-zinc-900 shadow-2xl transition-colors duration-200 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100'
            : 'w-full max-w-sm rounded-2xl border border-surface-line bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900'
        }
      >
        <h2
          id='mic-permission-title'
          className={native ? 'text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100' : 'text-lg font-semibold text-ink dark:text-zinc-100'}
        >
          Microphone access needed
        </h2>
        <p
          className={
            native
              ? 'mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'
              : 'mt-2 text-sm text-ink-soft dark:text-zinc-400'
          }
        >
          Pico needs your microphone to hear you in voice mode. Your {native ? 'app' : 'browser'} will ask for permission next.
        </p>
        <div className={native ? 'mt-6 flex flex-col gap-3' : 'mt-6 flex justify-end gap-2'}>
          <button
            type='button'
            onClick={onAllow}
            className={
              native
                ? 'w-full rounded-2xl bg-[#9EFF00] px-5 py-3.5 font-semibold text-zinc-950 shadow-[0_0_20px_rgba(158,255,0,0.2)] transition-all hover:bg-[#8ee000]'
                : 'rounded-full bg-[#9EFF00] px-4 py-1.5 text-sm font-medium text-black transition-opacity hover:opacity-90'
            }
          >
            Allow microphone
          </button>
          <button
            type='button'
            onClick={onDismiss}
            className={
              native
                ? 'w-full rounded-2xl py-3 text-sm font-medium text-zinc-600 transition-all hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900'
                : 'rounded-full border border-surface-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:bg-surface-muted dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-800'
            }
          >
            Use text instead
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default MicPermissionModal;
