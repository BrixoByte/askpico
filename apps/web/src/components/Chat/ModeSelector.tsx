import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { ModelOptions } from '@type/chat';
import { modelLabels, modelOptions } from '@constants/chat';
import DownChevronArrow from '@icon/DownChevronArrow';
import LockBadge from '@components/Auth/LockBadge';
import ModelWarningModal from './ModelWarningModal';
import useAuthGateStore from '@store/auth-gate-store';
import { useIsSignedIn } from '@utils/authGate';
import { isNativeMobileApp } from '@utils/device';

type ModeSelectorProps = {
  currentMode: ModelOptions;
  onModeChange: (mode: ModelOptions) => void;
  placement?: 'up' | 'down';
};

const WARNING_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour
const WARNING_TS_KEY = 'pico-model-warning-at';

const warningDue = () => {
  try {
    const last = Number(localStorage.getItem(WARNING_TS_KEY) ?? 0);
    return Date.now() - last >= WARNING_COOLDOWN_MS;
  } catch {
    return true;
  }
};

const markWarningShown = () => {
  try {
    localStorage.setItem(WARNING_TS_KEY, String(Date.now()));
  } catch {
    /* ignore storage failures */
  }
};

const ModeSelector = ({ currentMode, onModeChange, placement = 'up' }: ModeSelectorProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [warning, setWarning] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPos, setMenuPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
    width: number;
  } | null>(null);
  const signedIn = useIsSignedIn();

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        rootRef.current &&
        !rootRef.current.contains(target) &&
        !menuRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  // Anchor the portalled menu to the trigger so overflow-hidden ancestors
  // (the composer card) can't clip it. 'up' opens above, 'down' below.
  useEffect(() => {
    if (!open || !rootRef.current) return;
    const update = () => {
      const rect = rootRef.current!.getBoundingClientRect();
      const anchor =
        placement === 'down'
          ? { top: rect.bottom + 4 }
          : { bottom: window.innerHeight - rect.top + 4 };
      setMenuPos({ left: rect.left, width: rect.width, ...anchor });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [open, placement]);

  useEffect(() => {
    if (!warning) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWarning(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [warning]);

  const onTriggerClick = () => {
    if (!signedIn) {
      setOpen(false);
      useAuthGateStore.getState().open('Sign in to choose a mode.');
      return;
    }
    // Auto is locked: warn before even opening the dropdown,
    // but only once per hour (first time always warns).
    if (currentMode === 'auto' && warningDue()) {
      markWarningShown();
      setOpen(false);
      setWarning(true);
      return;
    }
    setOpen((prev) => !prev);
  };

  const confirmUnlock = () => {
    setWarning(false);
    setOpen(true);
  };

  const selectMode = (mode: ModelOptions) => {
    setOpen(false);
    if (mode !== currentMode) onModeChange(mode);
  };

  return (
    <div className='relative inline-block' ref={rootRef}>
      <button
        type='button'
        className='relative flex h-9 cursor-pointer items-center gap-2 rounded-full border border-zinc-700/80 bg-zinc-900/80 px-3 text-sm font-medium text-white transition-all duration-200 ease-in-out hover:border-emerald-500/50'
        onClick={onTriggerClick}
        aria-label='model selector'
        aria-haspopup='listbox'
        aria-expanded={open}
      >
        <svg
          viewBox='0 0 24 24'
          fill='currentColor'
          className='h-7 w-7 shrink-0 self-center text-[#8AE000] dark:text-[#9EFF00]'
          aria-hidden='true'
        >
          <path
            transform='translate(0 2.75)'
            d='M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4L12 3z'
          />
        </svg>
        <span className='max-w-[88px] truncate sm:max-w-[140px]'>
          {modelLabels[currentMode] ?? currentMode}
        </span>
        <DownChevronArrow />
        {!signedIn && <LockBadge />}
      </button>

      {open && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className='fixed z-[9999] flex max-h-72 flex-col gap-1 overflow-y-auto whitespace-nowrap rounded-xl border border-surface-line bg-surface p-1.5 shadow-card'
            style={{
              left: menuPos.left,
              top: menuPos.top,
              bottom: menuPos.bottom,
              width: menuPos.width,
            }}
            role='listbox'
          >
            {modelOptions.map((mode) => (
              <button
                type='button'
                key={mode}
                role='option'
                aria-selected={mode === currentMode}
                className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted ${
                  mode === currentMode
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-soft'
                }`}
                onClick={() => selectMode(mode)}
              >
                {modelLabels[mode]}
              </button>
            ))}
          </div>,
          document.getElementById('modal-root') ?? document.body
        )}

      {warning && isNativeMobileApp() && (
        <ModelWarningModal
          onClose={() => setWarning(false)}
          onConfirm={confirmUnlock}
        />
      )}

      {warning &&
        !isNativeMobileApp() &&
        createPortal(
          <div
            className='fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm fade-in'
            role='dialog'
            aria-modal='true'
            onClick={() => setWarning(false)}
          >
            <div
              className='modal-pop relative flex w-[92vw] max-w-md mx-auto flex-col items-center rounded-3xl border border-zinc-100 bg-surface p-4 sm:p-8 text-center shadow-2xl'
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type='button'
                className='absolute right-5 top-5 rounded-lg p-1 text-zinc-400 transition-colors hover:text-zinc-600'
                onClick={() => setWarning(false)}
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
                className='mb-4 sm:mb-6 h-24 w-24 sm:h-40 sm:w-40 object-contain'
              />

              <h3 className='mb-2 text-xl sm:text-2xl font-bold text-zinc-900'>
                Switching Model Warning
              </h3>

              <p className='mb-6 max-w-md text-sm leading-relaxed text-zinc-600'>
                Magic mode automatically picks the best model for your tasks
                to save your quota and optimize performance.
              </p>

              <div className='mb-8 w-full rounded-xl border border-amber-200/80 bg-amber-50/80 p-4 text-left'>
                <p className='mb-1 flex items-center gap-1.5 text-xs font-semibold text-amber-800'>
                  <svg
                    viewBox='0 0 24 24'
                    fill='none'
                    stroke='currentColor'
                    strokeWidth='2'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='h-3.5 w-3.5'
                  >
                    <path d='M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' />
                    <line x1='12' y1='9' x2='12' y2='13' />
                    <line x1='12' y1='17' x2='12.01' y2='17' />
                  </svg>
                  Attention Required:
                </p>
                <p className='text-xs leading-normal text-amber-900'>
                  Switching to manual mode (Quick, Smart, Deep) may consume
                  your daily token limit faster and exhaust your quota
                  prematurely.
                </p>
              </div>

              <div className='flex w-full flex-col-reverse items-center justify-center gap-3 sm:flex-row sm:gap-4'>
                <button
                  type='button'
                  className='w-full sm:flex-1 rounded-xl border border-zinc-200 px-5 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50'
                  onClick={() => setWarning(false)}
                >
                  Go Back
                </button>
                <button
                  type='button'
                  className='w-full sm:flex-1 rounded-xl bg-amber-600 px-5 py-3 font-medium text-white shadow-lg shadow-amber-600/20 transition-all hover:bg-amber-700'
                  onClick={confirmUnlock}
                >
                  Switch Model
                </button>
              </div>
            </div>
          </div>,
          document.getElementById('modal-root') ?? document.body
        )}
    </div>
  );
};

export default ModeSelector;
