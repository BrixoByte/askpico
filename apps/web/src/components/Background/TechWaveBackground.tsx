import React from 'react';

const TechWaveBackground = () => (
  <div className='pointer-events-none fixed inset-0 z-0 overflow-hidden'>
    <div className='absolute inset-0 hidden bg-[#09090b] dark:block' />
    <img
      src='/assets/bg-light.jpg'
      alt='Tech Waves Background'
      className='animate-tech-wave absolute inset-x-0 top-0 h-[120%] w-full select-none object-cover dark:hidden'
    />
    <img
      src='/assets/Emerald%20Waveframe%20Tech%20Background.png'
      alt='Tech Waves Background'
      className='animate-tech-wave absolute inset-0 hidden h-full w-full select-none object-cover opacity-90 mix-blend-screen dark:block'
    />
    <div className='absolute inset-0 hidden bg-[radial-gradient(circle_at_center,_transparent_20%,_rgba(9,9,11,0.8)_90%)] dark:block' />
  </div>
);

export default TechWaveBackground;
