import React from 'react';

// Native Android app home hero. Rendered only inside the native container
// (see ChatContent.tsx); the web and mobile-browser hero is EmptyState.
const MobileHomeLayout = () => {
  return (
    <div className='flex w-full flex-col items-center px-6 text-center'>
      <div className='relative my-4 flex justify-center'>
        <div className='logo-glow absolute -z-10 h-40 w-40 rounded-full bg-purple-500/20 blur-3xl dark:bg-[#9EFF00]/20' />
        <img
          src='/assets/brand/logo.png'
          alt='Pico'
          className='logo-shadow h-32 w-32 object-contain drop-shadow-[0_10px_25px_rgba(168,85,247,0.35)] sm:h-40 sm:w-40 dark:drop-shadow-[0_10px_25px_rgba(132,204,22,0.35)]'
        />
      </div>
      <div className='mx-auto max-w-xs space-y-2 px-4 text-center'>
        <h1 className='text-3xl font-bold leading-tight tracking-tight text-zinc-900 sm:text-4xl dark:text-zinc-100'>
          Good to <span className='text-[#84cc16] dark:text-[#9EFF00]'>see you</span>.
        </h1>
        <p className='px-2 text-xs leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-400'>
          Your ideas start here. What would you like to explore today?
        </p>
      </div>
    </div>
  );
};

export default MobileHomeLayout;
