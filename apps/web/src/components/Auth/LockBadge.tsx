import React from 'react';

// Small lock shown on controls that require a signed-in account.
const LockBadge = () => (
  <span
    className='pointer-events-none absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-surface text-ink-muted shadow-soft'
    aria-hidden='true'
  >
    <svg
      viewBox='0 0 24 24'
      className='h-2.5 w-2.5'
      fill='none'
      stroke='currentColor'
      strokeWidth='2.5'
      strokeLinecap='round'
      strokeLinejoin='round'
    >
      <rect x='5' y='11' width='14' height='10' rx='2' />
      <path d='M8 11V7a4 4 0 0 1 8 0v4' />
    </svg>
  </span>
);

export default LockBadge;
