import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import useUsageStore from '@store/usage-store';
import { fetchReferralCode } from '@api/api';

const LinkIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4' aria-hidden='true'>
    <path d='M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' />
    <path d='M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' />
  </svg>
);

const ExternalIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4' aria-hidden='true'>
    <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
    <path d='M15 3h6v6' />
    <path d='M10 14 21 3' />
  </svg>
);

const RocketIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4' aria-hidden='true'>
    <path d='M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z' />
    <path d='m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z' />
    <path d='M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0' />
    <path d='M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' />
  </svg>
);

const ChevronRight = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4' aria-hidden='true'>
    <path d='m9 18 6-6-6-6' />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' className='h-4 w-4' aria-hidden='true'>
    <path d='M18 6 6 18M6 6l12 12' />
  </svg>
);

const GiftGlyph = () => (
  <svg viewBox='0 0 64 64' className='h-16 w-16 drop-shadow-[0_0_12px_rgba(132,204,22,0.5)]' aria-hidden='true'>
    <rect x='12' y='26' width='40' height='30' rx='3' fill='#27272a' />
    <rect x='12' y='20' width='40' height='9' rx='2' fill='#9EFF00' />
    <rect x='29' y='20' width='6' height='36' fill='#9EFF00' />
    <path d='M32 20c-6-10-14-8-12-2 1 3 12 2 12 2zm0 0c6-10 14-8 12-2-1 3-12 2-12 2z' fill='#B8FF4D' />
  </svg>
);

const StarGlyph = () => (
  <svg viewBox='0 0 64 64' className='h-16 w-16 drop-shadow-[0_0_12px_rgba(132,204,22,0.5)]' aria-hidden='true'>
    <defs>
      <linearGradient id='quota-star' x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0' stopColor='#d9f99d' />
        <stop offset='0.5' stopColor='#9EFF00' />
        <stop offset='1' stopColor='#4d7c0f' />
      </linearGradient>
    </defs>
    <path d='M32 4l8.5 18.5L60 25l-14.5 13L49 58 32 48 15 58l3.5-20L4 25l19.5-2.5z' fill='url(#quota-star)' />
  </svg>
);

const QuotaExceededModal = () => {
  const setQuotaOpen = useUsageStore((state) => state.setQuotaOpen);
  const setUpgradeOpen = useUsageStore((state) => state.setUpgradeOpen);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        try {
          localStorage.setItem('pico_quota_modal_dismissed_at', String(Date.now()));
        } catch {
          // ignore
        }
        setQuotaOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [setQuotaOpen]);

  const close = () => {
    try {
      localStorage.setItem('pico_quota_modal_dismissed_at', String(Date.now()));
    } catch {
      // storage unavailable — dismissal just won't persist
    }
    setQuotaOpen(false);
  };

  const copyInviteLink = async () => {
    try {
      const code = await fetchReferralCode();
      const link = `${window.location.origin}/?ref=${code}`;
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const upgrade = () => {
    setQuotaOpen(false);
    setUpgradeOpen(true);
  };

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md'
      onMouseDown={close}
    >
      <div
        className='relative w-full max-w-2xl overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#0B0F0E] p-6 shadow-[0_0_30px_rgba(16,185,129,0.15)] sm:p-8'
        onMouseDown={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-labelledby='quota-modal-title'
      >
        <button
          type='button'
          onClick={close}
          aria-label='close'
          className='absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-emerald-500/40 hover:text-zinc-100'
        >
          <CloseIcon />
        </button>

        <div className='flex flex-col items-center text-center'>
          <div className='flex items-center gap-2 text-sm font-semibold tracking-widest text-zinc-100'>
            <span className='h-5 w-5 rounded-full bg-gradient-to-br from-lime-300 to-lime-600 shadow-[0_0_10px_rgba(132,204,22,0.6)]' />
            PICO AI
          </div>
          <h2 id='quota-modal-title' className='mt-4 text-2xl font-bold text-zinc-100'>
            Fuel Your <span className='text-[#9EFF00]'>Creativity</span>
          </h2>
          <p className='mt-2 text-sm text-zinc-400'>
            Invite friends and unlock premium features with PICO AI.
          </p>
        </div>

        <div className='mt-6 grid gap-4 sm:grid-cols-2'>
          <div className='flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5'>
            <div className='flex items-center gap-4'>
              <GiftGlyph />
              <div>
                <h3 className='text-base font-semibold text-zinc-100'>Invite Friends &amp; Earn</h3>
                <p className='mt-1 text-sm text-zinc-400'>
                  Share PICO AI with your friends and earn <span className='text-[#9EFF00]'>free hours!</span>
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={() => void copyInviteLink()}
              className='mt-5 flex w-full items-center justify-between rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-700'
            >
              <span className='flex items-center gap-2'>
                <LinkIcon />
                {copied ? 'Link Copied!' : 'Copy Invite Link'}
              </span>
              <ExternalIcon />
            </button>
          </div>

          <div className='flex flex-col justify-between rounded-2xl border border-emerald-500/30 bg-zinc-900/80 p-5'>
            <div className='flex items-center gap-4'>
              <StarGlyph />
              <div>
                <h3 className='text-base font-semibold text-zinc-100'>Go Unlimited</h3>
                <p className='mt-1 text-sm text-zinc-400'>
                  Upgrade to unlock <span className='text-[#9EFF00]'>unlimited access</span> and premium features.
                </p>
              </div>
            </div>
            <button
              type='button'
              onClick={upgrade}
              className='mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#9EFF00] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#B8FF4D]'
            >
              <RocketIcon />
              Upgrade Plan
              <ChevronRight />
            </button>
          </div>
        </div>

        <div className='mt-6 flex items-center gap-4'>
          <span className='h-px flex-1 bg-gradient-to-r from-transparent to-zinc-700' />
          <p className='text-[11px] uppercase tracking-[0.25em] text-zinc-500'>
            More power. More possibilities.
          </p>
          <span className='h-px flex-1 bg-gradient-to-l from-transparent to-zinc-700' />
        </div>
      </div>
    </div>,
    document.body
  );
};

export default QuotaExceededModal;
