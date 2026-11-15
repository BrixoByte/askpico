import React, { useEffect, useRef } from 'react';

import useStore from '@store/store';

import SidebarHeader from './SidebarHeader';
import ChatHistoryList from './ChatHistoryList';
import UpgradePromoCard from './UpgradePromoCard';
import ProfileCard from './ProfileCard';
import MobileSidebarDrawer from './MobileSidebarDrawer';
import LandscapeSidebar from './LandscapeSidebar';

import CrossIcon2 from '@icon/CrossIcon2';
import { isNativeMobileApp, useLandscapeNativeApp } from '@utils/device';

const Menu = () => {
  const hideSideMenu = useStore((state) => state.hideSideMenu);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);

  const windowWidthRef = useRef<number>(window.innerWidth);

  useEffect(() => {
    if (window.innerWidth < 768) setHideSideMenu(true);
    window.addEventListener('resize', () => {
      if (
        windowWidthRef.current !== window.innerWidth &&
        window.innerWidth < 768
      )
        setHideSideMenu(true);
    });
  }, []);

  const landscapeNative = useLandscapeNativeApp();

  if (isNativeMobileApp()) {
    return landscapeNative ? <LandscapeSidebar /> : <MobileSidebarDrawer />;
  }

  return (
    <>
      <div
        id='menu'
        className={`group/menu fixed md:flex md:w-64 md:flex-col transition-transform duration-300 ease-in-out z-[999] inset-y-0 left-0 h-full md:h-auto md:inset-y-0 md:left-0 md:rounded-none md:border-r md:border-surface-line md:bg-zinc-50 dark:md:border-zinc-800/80 dark:md:bg-[#0b0f0e] max-md:w-full max-md:bg-zinc-50 dark:max-md:bg-zinc-950 max-md:border-r max-md:border-surface-line max-md:shadow-2xl max-md:pt-[env(safe-area-inset-top)] max-md:pb-[env(safe-area-inset-bottom)] ${
          hideSideMenu ? 'translate-x-[-100%]' : 'translate-x-[0%]'
        }`}
      >
        <div className='flex h-full min-h-0 flex-col'>
          <nav className='flex h-full flex-1 flex-col space-y-3 px-4 pb-6 pt-3'>
            <SidebarHeader />
            <ChatHistoryList />
            <UpgradePromoCard />
            <ProfileCard />
          </nav>
        </div>
        <div
          id='menu-close'
          className={`${
            hideSideMenu ? 'hidden' : ''
          } md:hidden absolute z-[999] right-2 top-[calc(0.75rem+env(safe-area-inset-top))] flex h-12 w-12 items-center justify-center rounded-md bg-ink/5 text-ink-muted hover:bg-ink/10 cursor-pointer`}
          onClick={() => {
            setHideSideMenu(true);
          }}
        >
          <CrossIcon2 />
        </div>
      </div>
      <div
        id='menu-backdrop'
        className={`md:hidden fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
          hideSideMenu ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        onClick={() => {
          setHideSideMenu(true);
        }}
      />
    </>
  );
};

export default Menu;
