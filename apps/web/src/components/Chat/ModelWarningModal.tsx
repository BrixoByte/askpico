import React from 'react';
import { createPortal } from 'react-dom';

type ModelWarningModalProps = {
  onClose: () => void;
  onConfirm: () => void;
};

// Native Android app only (rendered by ModeSelector when isNativeMobileApp()).
// Dark obsidian design; web browsers keep the original dialog in ModeSelector.
const ModelWarningModal = ({ onClose, onConfirm }: ModelWarningModalProps) =>
  createPortal(
    <div
      className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md fade-in'
      role='dialog'
      aria-modal='true'
      onClick={onClose}
    >
      <div
        className='modal-pop relative flex w-full max-w-sm flex-col items-center rounded-3xl border border-zinc-800 bg-zinc-950 p-6 text-center text-zinc-100 shadow-2xl'
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type='button'
          className='absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:text-white'
          onClick={onClose}
          aria-label='dismiss warning'
        >
          <svg
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            className='h-5 w-5'
          >
            <line x1='18' y1='6' x2='6' y2='18' />
            <line x1='6' y1='6' x2='18' y2='18' />
          </svg>
        </button>

        <img
          src='/assets/brand/logo.png'
          alt='Pico logo'
          className='mb-4 h-20 w-20 object-contain'
        />

        <h3 className='mb-2 text-xl font-bold text-zinc-100 text-center'>
          Switching Model Warning
        </h3>

        <p className='mb-5 text-sm leading-relaxed text-zinc-400'>
          Magic mode auto-picks the best model to optimize speed and tokens.
        </p>

        <div className='mb-6 w-full rounded-xl border border-zinc-800/80 bg-zinc-900/80 p-3 text-left text-xs text-zinc-300'>
          <p className='mb-1 flex items-center gap-1.5 font-semibold text-amber-400'>
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-3.5 w-3.5'
              aria-hidden='true'
            >
              <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
              <line x1='12' y1='9' x2='12' y2='13' />
              <line x1='12' y1='17' x2='12.01' y2='17' />
            </svg>
            Attention Required:
          </p>
          <p className='leading-normal'>
            Switching to manual mode (Quick, Smart, Deep) may consume your daily
            token limit faster and exhaust your quota prematurely.
          </p>
        </div>

        <div className='flex w-full flex-col gap-3'>
          <button
            type='button'
            className='min-h-[44px] w-full rounded-xl bg-[#9EFF00] px-5 py-3 font-semibold text-zinc-950 shadow-[0_0_20px_rgba(158,255,0,0.2)] transition-all hover:bg-[#8ee000]'
            onClick={onConfirm}
          >
            Switch Model
          </button>
          <button
            type='button'
            className='min-h-[44px] w-full rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-3 font-medium text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-white'
            onClick={onClose}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>,
    document.getElementById('modal-root') ?? document.body
  );

export default ModelWarningModal;
