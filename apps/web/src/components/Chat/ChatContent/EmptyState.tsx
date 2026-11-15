import React from 'react';


const EmptyState = ({ showDivider = true }: { showDivider?: boolean }) => {
  return (
    <div className='flex w-full flex-col items-center px-6 pt-0 text-center'>
      <div className='relative mb-5 flex items-center justify-center'>
        <div className='logo-glow absolute -z-10 h-48 w-48 rounded-full bg-purple-500/20 blur-3xl dark:bg-[#9EFF00]/20' />
        <img
          src='/assets/brand/logo.png'
          alt='Pico'
          className='logo-shadow h-48 w-48 object-contain drop-shadow-[0_10px_25px_rgba(168,85,247,0.35)] sm:h-[13.2rem] sm:w-[13.2rem] dark:drop-shadow-[0_10px_25px_rgba(132,204,22,0.35)]'
        />
      </div>
      <h1 className='text-5xl font-semibold tracking-tight text-ink sm:text-5xl dark:text-white'>
        Good to <span className='bg-gradient-to-r from-[#8AE000] to-emerald-400 dark:from-[#9EFF00] dark:to-teal-300 bg-clip-text text-transparent'>see you</span>.
      </h1>
      <p className='mt-3 text-xl text-ink-muted sm:text-xl dark:text-zinc-400'>
        Your ideas start here. What would you like to explore today?
      </p>
      {showDivider && (
        <div className='relative mx-auto my-6 flex w-full max-w-xs items-center justify-center'>
          {/* Left fading line */}
          <div className='h-[1px] flex-1 bg-gradient-to-r from-transparent to-lime-500/80' />
          {/* Center star */}
          <div className='mx-3 flex items-center justify-center text-[#8AE000] dark:text-[#9EFF00]'>
            <svg viewBox='0 0 24 24' fill='currentColor' className='h-12 w-12' aria-hidden='true'>
              <path d='M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z' />
            </svg>
          </div>
          {/* Right fading line */}
          <div className='h-[1px] flex-1 bg-gradient-to-r from-lime-500/80 to-transparent' />
        </div>
      )}
    </div>
  );
};

export default EmptyState;
