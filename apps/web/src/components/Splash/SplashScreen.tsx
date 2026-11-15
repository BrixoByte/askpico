import React, { useEffect, useState } from 'react';

const HOLD_MS = 1200;
const FADE_MS = 300;

const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => setFading(true), HOLD_MS);
    const doneTimer = window.setTimeout(onDone, HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      role='status'
      aria-label='Pico is loading'
      className={`fixed inset-0 z-[100] flex h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#7A46E3] transition-opacity duration-300 ${
        fading ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      <img src='/assets/brand/logo.png' alt='Pico' className='h-36 w-36 object-contain' />
    </div>
  );
};

export default SplashScreen;
