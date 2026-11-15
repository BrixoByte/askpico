import React from 'react';
import useStore from '@store/store';

import { resolveTheme } from '@utils/theme';
import SunIcon from '@icon/SunIcon';
import MoonIcon from '@icon/MoonIcon';
import { ChevronsRightIcon } from '@icon/ui';

const ChatHeader = () => {
  const setTheme = useStore((state) => state.setTheme);
  const resolvedTheme = resolveTheme(useStore((state) => state.theme));
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);

  return (
    <div className='relative z-40 hidden shrink-0 items-center justify-end gap-2 bg-transparent px-4 py-3 dark:bg-transparent md:flex'>
      {hideSideMenu && (
        <button
          className='icon-btn !h-9 !w-9 mr-auto shrink-0 rounded-full !border-ink/10 !bg-ink/5 shadow-lg backdrop-blur-md transition-all hover:!bg-ink/10 dark:!border-white/10 dark:!bg-white/5 dark:hover:!bg-white/10'
          onClick={() => setHideSideMenu(false)}
          aria-label='open sidebar'
        >
          <ChevronsRightIcon className='h-4 w-4' />
        </button>
      )}
      <button
        onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
        aria-label='toggle dark/light mode'
        className='icon-btn !h-9 !w-9 rounded-full !border-ink/10 !bg-ink/5 shadow-lg backdrop-blur-md transition-all hover:!bg-ink/10 dark:!border-white/10 dark:!bg-white/5 dark:backdrop-blur-md dark:hover:!bg-white/10'
      >
        {resolvedTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
      </button>
    </div>
  );
};

export default ChatHeader;
