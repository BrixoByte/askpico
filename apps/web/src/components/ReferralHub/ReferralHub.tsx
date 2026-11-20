import React, { useState } from 'react';
import type { ReferralStats } from '@api/api';

interface ReferralHubProps {
  isSignedIn: boolean;
  referralLink: string;
  stats: ReferralStats | null;
  error: string | null;
}

const COPIED_MS = 2000;

const MetricCard = ({ label, value, hint }: { label: string; value: string; hint: string }) => (
  <div className='rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60'>
    <div className='text-xs font-medium text-gray-500 dark:text-gray-400'>{label}</div>
    <div className='mt-1 text-2xl font-semibold text-gray-900 dark:text-white'>{value}</div>
    <div className='mt-1 text-xs text-gray-400 dark:text-gray-500'>{hint}</div>
  </div>
);

const ReferralHub = ({ isSignedIn, referralLink, stats, error }: ReferralHubProps) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setCopyError(null);
      setTimeout(() => setCopied(false), COPIED_MS);
    } catch {
      setCopyError('Copy failed. Select the link and copy it manually.');
    }
  };

  if (!isSignedIn) {
    return (
      <p className='text-xs text-gray-500 dark:text-gray-400'>
        Sign in with your email to get your referral link.
      </p>
    );
  }

  return (
    <div className='flex flex-col gap-4 rounded-2xl border border-gray-200 bg-surface p-5 dark:border-gray-700'>
      <div>
        <div className='text-sm font-semibold text-gray-900 dark:text-white'>Your referral link</div>
        <div className='text-xs text-gray-500 dark:text-gray-400'>
          Rewards are added after your friend verifies email.
        </div>
      </div>

      <div className='flex items-center gap-2'>
        <input
          readOnly
          value={referralLink}
          onFocus={(e) => e.currentTarget.select()}
          className='min-w-0 flex-1 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-xs text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-white'
        />
        <button
          type='button'
          onClick={copyLink}
          disabled={!referralLink}
          className='shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50'
          aria-live='polite'
        >
          {copied ? 'Copied!' : 'Copy link'}
        </button>
      </div>
      {copyError && <p className='text-xs text-red-500'>{copyError}</p>}
      {error && <p className='text-xs text-red-500'>{error}</p>}

      {stats && (
        <div className='grid grid-cols-2 gap-3'>
          <MetricCard label='Link clicks' value={stats.clicks.toLocaleString()} hint='Visits via your link' />
          <MetricCard label='Free sign-ups' value={stats.freeSignups.toLocaleString()} hint='Referred, on free plan' />
          <MetricCard label='Paid upgrades' value={stats.paidUpgrades.toLocaleString()} hint='Referred, on a paid plan' />
          <MetricCard
            label='Bonus minutes'
            value={Math.floor(stats.earnedSeconds / 60).toLocaleString()}
            hint='Earned from referrals'
          />
        </div>
      )}
    </div>
  );
};

export default ReferralHub;
