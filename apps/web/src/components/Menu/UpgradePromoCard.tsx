import React, { useState } from 'react';

import UpgradePlanModal from '@components/UpgradeModal/UpgradePlanModal';

const UpgradePromoCard = () => {
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <>
      <button
        type='button'
        onClick={() => setUpgradeOpen(true)}
        aria-label='Upgrade to Pro'
        className='relative hidden w-full cursor-pointer overflow-hidden rounded-2xl border border-emerald-500/40 bg-[#121316] text-left transition-all duration-200 ease-in-out hover:border-emerald-500/60 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] md:block'
      >
        <img
          src='/assets/Neon%20Emerald%20Crystal%20Energy%20Banner.png'
          alt=''
          aria-hidden='true'
          className='absolute inset-0 h-full w-full rounded-2xl object-cover'
        />

        <div className='relative z-10 flex items-center justify-between p-3'>
          <div className='flex items-center'>
            {/* gold crown */}
            <svg
              viewBox='0 0 24 24'
              fill='currentColor'
              className='mr-3 h-6 w-6 flex-shrink-0 text-amber-400'
              aria-hidden='true'
            >
              <path d='M5 16.5 3.6 7l4.7 3.4L12 4.8l3.7 5.6L20.4 7 19 16.5H5zm0 2h14v1.5H5v-1.5z' />
            </svg>
            <div className='flex flex-col'>
              <span className='text-sm font-semibold leading-tight text-zinc-100'>
                Upgrade to Pro
              </span>
              <span className='mt-0.5 text-xs text-zinc-400'>
                Unlock more power
              </span>
            </div>
          </div>

        </div>
      </button>

      {upgradeOpen && <UpgradePlanModal onClose={() => setUpgradeOpen(false)} />}
    </>
  );
};

export default UpgradePromoCard;
