import React, { useState } from 'react';
import useStore from '@store/store';
import useProfileStore, { profileDisplayName } from '@store/profile-store';
import useAuthGateStore from '@store/auth-gate-store';
import { useIsSignedIn } from '@utils/authGate';

import SettingsMenu from '@components/SettingsMenu';
import Logout from '@components/Menu/MenuOptions/Logout';
import GoogleSync from '@components/GoogleSync';
import { TotalTokenCostDisplay } from '@components/SettingsMenu/TotalTokenCost';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || undefined;

const ProfileCard = () => {
  const name = useProfileStore((state) => state.name);
  const email = useProfileStore((state) => state.email);
  const isSignedIn = useIsSignedIn();

  const [optionsOpen, setOptionsOpen] = useState<boolean>(false);

  const displayName = profileDisplayName(name);
  const initial = displayName.charAt(0).toUpperCase();

  const handleProfileClick = () => {
    if (!isSignedIn) {
      useAuthGateStore.getState().open('Sign in to keep your chats and memory across devices.');
      return;
    }
    setOptionsOpen((prev) => !prev);
  };

  return (
    <div className='relative !mt-auto pt-3'>
      <div
        className='relative z-10 flex w-full cursor-pointer items-center justify-between rounded-2xl border border-zinc-200 bg-white p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-all duration-200 ease-in-out hover:border-emerald-500/40 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/60 dark:shadow-none dark:hover:bg-zinc-900'
        onClick={handleProfileClick}
      >
        <div className='relative h-10 w-10 flex-shrink-0 overflow-visible rounded-full border border-zinc-700'>
          <div className='flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-sm font-semibold text-white'>
            {initial}
          </div>
          <span className='absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-[#8AE000] dark:border-zinc-900 dark:bg-[#9EFF00]' />
        </div>
        <div className='ml-3 flex-1 flex-col overflow-hidden'>
          <div className='truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100'>
            {displayName}
          </div>
          <div className='mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400'>
            {email || 'Free Plan'}
          </div>
        </div>
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className='ml-2 h-4 w-4 flex-shrink-0 text-zinc-500 dark:text-zinc-400'
          aria-hidden='true'
        >
          <path d='m9 18 6-6-6-6' />
        </svg>
      </div>

      {optionsOpen && (
        <OptionsPopover close={() => setOptionsOpen(false)} />
      )}
    </div>
  );
};

const OptionsPopover = ({ close }: { close: () => void }) => {
  const countTotalTokens = useStore((state) => state.countTotalTokens);
  const [ref] = useOutsideRef(close);

  return (
    <div
      ref={ref}
      className='animate-popover-rise absolute bottom-full left-0 mb-2 w-full rounded-2xl border border-gray-100 bg-white p-2 shadow-xl z-50 dark:border-neutral-800 dark:bg-neutral-900'
    >
      {countTotalTokens && <TotalTokenCostDisplay />}
      {googleClientId && <GoogleSync clientId={googleClientId} />}
      <SettingsMenu />
      <Logout />
    </div>
  );
};

const useOutsideRef = (close: () => void) => {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Portaled modals (e.g. SettingsPopup) render under #modal-root,
        // outside this popover's DOM subtree — don't treat their clicks as outside.
        if (
          e.target instanceof Element &&
          e.target.closest('#modal-root')
        )
          return;
        close();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [close]);
  return [ref] as const;
};

export default ProfileCard;
