import React from 'react';

import useStore from '@store/store';
import { useCompactViewport } from '@utils/device';
import { PanelLeftIcon } from '@icon/ui';

import SidebarHeader from './SidebarHeader';
import ChatHistoryList from './ChatHistoryList';
import UpgradePromoCard from './UpgradePromoCard';
import ProfileCard from './ProfileCard';

// Persistent left sidebar shown on the Android app in landscape, mirroring the
// desktop website layout: fixed 240px column, header / scrollable middle / footer.
const LandscapeSidebar = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const compact = useCompactViewport();

  if (hideSideMenu) {
    return (
      <button
        type='button'
        aria-label='open sidebar'
        onClick={() => setHideSideMenu(false)}
        className='fixed left-2 top-[calc(0.75rem+env(safe-area-inset-top))] z-[998] flex h-11 w-11 items-center justify-center rounded-md bg-ink/5 text-ink-muted hover:bg-ink/10'
      >
        <PanelLeftIcon className='h-5 w-5' />
      </button>
    );
  }

  return (
    <div
      id='menu-landscape'
      className={`fixed inset-y-0 left-0 z-[999] flex w-60 flex-col border-r border-surface-line bg-zinc-50 transition-transform duration-300 dark:border-zinc-800/80 dark:bg-[#0b0f0e] ${
        compact
          ? '[&_img]:!h-10 [&>div>nav]:!space-y-1 [&>div>nav]:!px-3 [&>div>nav]:!pb-3 [&>div>nav]:!pt-2'
          : '[&_img]:!h-14'
      }`}
    >
      <div className='flex h-full min-h-0 flex-col'>
        <nav className='flex h-full flex-1 flex-col space-y-3 overflow-hidden px-4 pb-4 pt-3 [&_.sidebar-link]:min-h-[48px]'>
          <SidebarHeader collapseAlways />
          <ChatHistoryList />
          {!compact && <UpgradePromoCard />}
          <ProfileCard />
        </nav>
      </div>
    </div>
  );
};

export default LandscapeSidebar;
