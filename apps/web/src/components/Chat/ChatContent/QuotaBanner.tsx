import React, { useState } from 'react';
import useUsageStore from '@store/usage-store';
import { fetchReferralCode } from '@api/api';

const DISMISS_KEY = 'pico_quota_modal_dismissed_at';

const COPY: Record<string, { title: string; body: string }> = {
  busy: {
    title: 'Service is busy',
    body: 'Pico is handling too many requests right now. Try again in a moment — your message was not lost.',
  },
  cap: {
    title: 'Daily limit reached',
    body: 'You have used today\'s free messages. It resets at midnight. You can still read history and use tools.',
  },
  referral: {
    title: 'Fuel your creativity',
    body: 'Invite friends to Pico and earn more free messages.',
  },
};

// Inline banner above the composer — pushes layout instead of covering it,
// so the composer and Send button always stay reachable.
const QuotaBanner = () => {
  const quotaOpen = useUsageStore((s) => s.quotaOpen);
  const quotaKind = useUsageStore((s) => s.quotaKind);
  const setQuotaOpen = useUsageStore((s) => s.setQuotaOpen);
  const setUpgradeOpen = useUsageStore((s) => s.setUpgradeOpen);
  const [copied, setCopied] = useState(false);

  if (!quotaOpen) return null;
  const kind = quotaKind ?? 'referral';
  const copy = COPY[kind] ?? COPY.referral;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
    setQuotaOpen(false);
  };

  const copyInvite = async () => {
    try {
      const code = await fetchReferralCode();
      await navigator.clipboard.writeText(`${window.location.origin}/?ref=${code}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role='status'
      aria-live='polite'
      className='mx-auto mb-2 flex w-full max-w-3xl items-start gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-950/60 px-4 py-3 text-left backdrop-blur dark:border-emerald-500/30'
    >
      <div className='min-w-0 flex-1'>
        <p className='text-sm font-semibold text-zinc-100'>{copy.title}</p>
        <p className='mt-0.5 text-xs text-zinc-400'>{copy.body}</p>
        {kind !== 'busy' && (
          <div className='mt-2 flex flex-wrap items-center gap-2'>
            <button
              type='button'
              onClick={copyInvite}
              className='min-h-[48px] rounded-full bg-[#9EFF00] px-4 text-sm font-semibold text-black'
            >
              {copied ? 'Link copied' : 'Invite friends'}
            </button>
            <button
              type='button'
              onClick={() => {
                setQuotaOpen(false);
                setUpgradeOpen(true);
              }}
              className='min-h-[48px] rounded-full border border-zinc-700 px-4 text-sm text-zinc-200'
            >
              Upgrade
            </button>
          </div>
        )}
      </div>
      <button
        type='button'
        onClick={dismiss}
        aria-label='Dismiss'
        className='flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-zinc-100'
      >
        <svg width='14' height='14' viewBox='0 0 14 14' fill='none' aria-hidden='true'>
          <path d='M1 1l12 12M13 1L1 13' stroke='currentColor' strokeWidth='2' strokeLinecap='round' />
        </svg>
      </button>
    </div>
  );
};

export default QuotaBanner;
