import React from 'react';
import useStore from '@store/store';

import SidebarHeader from './SidebarHeader';
import ChatHistoryList from './ChatHistoryList';
import ProfileCard from './ProfileCard';

import CrossIcon2 from '@icon/CrossIcon2';
import SunIcon from '@icon/SunIcon';
import MoonIcon from '@icon/MoonIcon';
import { resolveTheme } from '@utils/theme';

const MobileThemeToggle = () => {
  const setTheme = useStore((state) => state.setTheme);
  const resolvedTheme = resolveTheme(useStore((state) => state.theme));

  return (
    <div className='my-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-100 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900'>
      <span className='text-xs font-medium text-zinc-600 dark:text-zinc-400'>Appearance</span>
      <div className='flex items-center gap-1 rounded-lg bg-zinc-200 p-1 dark:bg-zinc-800'>
        <button
          type='button'
          onClick={() => setTheme('light')}
          aria-label='Light Mode'
          aria-pressed={resolvedTheme === 'light'}
          className={`flex h-12 w-12 items-center justify-center rounded-md transition-colors ${
            resolvedTheme === 'light' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
          }`}
        >
          <SunIcon />
        </button>
        <button
          type='button'
          onClick={() => setTheme('dark')}
          aria-label='Dark Mode'
          aria-pressed={resolvedTheme === 'dark'}
          className={`flex h-12 w-12 items-center justify-center rounded-md transition-colors ${
            resolvedTheme === 'dark' ? 'bg-zinc-950 text-[#9EFF00] shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
          }`}
        >
          <MoonIcon />
        </button>
      </div>
    </div>
  );
};

// Native Android WebView drawer. Follows the global light/dark theme tokens,
// independent of the responsive web sidebar in Menu.tsx.
const MobileSidebarDrawer = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);

  return (
    <>
      <div
        id='menu'
        className={`fixed inset-y-0 left-0 z-50 flex w-full sm:max-w-sm flex-col justify-between overflow-hidden border-r border-zinc-200 bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] text-zinc-900 shadow-2xl transition-all duration-300 ease-in-out dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 [&_.sidebar-link]:min-h-[48px] [&_.sidebar-link]:text-zinc-600 [&_.sidebar-link:hover]:bg-zinc-100 [&_.sidebar-link:hover]:text-zinc-900 dark:[&_.sidebar-link]:text-zinc-300 dark:[&_.sidebar-link:hover]:bg-zinc-900 dark:[&_.sidebar-link:hover]:text-white ${
          hideSideMenu ? '-translate-x-full' : 'translate-x-0'
        }`}
      >
        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&_img]:!h-14 [&_img]:!max-w-full'>
          <SidebarHeader hideCollapse />
          <ChatHistoryList fillHeight={false} />
          <MobileThemeToggle />
        </div>
        <ProfileCard />
        <button
          type='button'
          id='menu-close'
          aria-label='close sidebar'
          onClick={() => setHideSideMenu(true)}
          className='absolute right-2 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-12 w-12 cursor-pointer items-center justify-center rounded-md text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white'
        >
          <CrossIcon2 />
        </button>
      </div>
      <div
        id='menu-backdrop'
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          hideSideMenu ? 'pointer-events-none opacity-0' : 'opacity-100'
        }`}
        onClick={() => setHideSideMenu(true)}
      />
    </>
  );
};

export default MobileSidebarDrawer;
