import React from 'react';
import useStore from '@store/store';

import { ChevronsLeftIcon } from '@icon/ui';

const SidebarHeader = ({
  hideCollapse = false,
  collapseAlways = false,
}: {
  hideCollapse?: boolean;
  collapseAlways?: boolean;
}) => {
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);

  return (
    <div className='flex items-center justify-between gap-3 px-1 pb-4 pt-0'>
      <div className='flex h-14 items-center gap-2.5 overflow-hidden'>
        <img
          src='/assets/brand/logo-sidebar-light.png'
          alt='Pico logo'
          className='h-[2.8rem] w-auto max-w-full object-contain md:h-32 dark:hidden'
        />
        <img
          src='/assets/brand/logo-sidebar-dark.png'
          alt='Pico logo'
          className='hidden h-[2.8rem] w-auto max-w-full object-contain md:h-32 dark:block'
        />
      </div>
      <button
        className={`${hideCollapse ? 'hidden' : collapseAlways ? 'flex' : 'hidden md:flex'} icon-btn !h-12 !w-12 shrink-0 rounded-full !border-ink/10 !bg-ink/5 shadow-lg backdrop-blur-md transition-all hover:!bg-ink/10 dark:!border-white/10 dark:!bg-white/5 dark:hover:!bg-white/10`}
        onClick={() => setHideSideMenu(true)}
        aria-label='close sidebar'
      >
        <ChevronsLeftIcon className='h-4 w-4' />
      </button>
    </div>
  );
};

export default SidebarHeader;
