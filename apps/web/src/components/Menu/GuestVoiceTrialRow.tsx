import React from 'react';
import useGuestVoiceStore from '@store/guest-voice-store';
import { authUrl } from '@utils/authRoutes';
import { formatTrialTime } from '@voice/guestVoiceTimer';

export type TrialRowState = { kind: 'hidden' } | { kind: 'left'; label: string } | { kind: 'used' };

// Guests only, and only once the balance is known. Signed-in users never see the row.
export const trialRowState = (isGuest: boolean | null, remaining: number | null): TrialRowState => {
  if (!isGuest || remaining === null) return { kind: 'hidden' };
  if (remaining <= 0) return { kind: 'used' };
  return { kind: 'left', label: `Voice trial: ${formatTrialTime(remaining)} left` };
};

// Sits above the Appearance row in the mobile sidebar. Isolated so it is easy to move.
const GuestVoiceTrialRow = () => {
  const isGuest = useGuestVoiceStore((state) => state.isGuest);
  const remaining = useGuestVoiceStore((state) => state.remaining);
  const row = trialRowState(isGuest, remaining);

  if (row.kind === 'hidden') return null;
  if (row.kind === 'used') {
    return (
      <div className='flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-zinc-100 px-3 dark:border-zinc-800 dark:bg-zinc-900'>
        <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>Voice trial used</span>
        <button
          type='button'
          aria-label='Sign in to keep using voice'
          onClick={() => window.location.assign(authUrl())}
          className='min-h-[48px] min-w-[48px] rounded-lg bg-[#9EFF00] px-3 text-xs font-semibold text-black'
        >
          Sign in
        </button>
      </div>
    );
  }
  return (
    <div
      role='status'
      aria-label={row.label}
      className='flex min-h-[48px] items-center rounded-xl border border-zinc-200 bg-zinc-100 px-3 dark:border-zinc-800 dark:bg-zinc-900'
    >
      <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>{row.label}</span>
    </div>
  );
};

export default GuestVoiceTrialRow;
