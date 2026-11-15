import React, { useEffect, useRef, useState } from 'react';

export interface SelectMenuOption<T extends string> {
  value: T;
  label: string;
}

const SelectMenu = <T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: SelectMenuOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
}) => {
  const [open, setOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = options.find((item) => item.value === value);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className='relative w-full'>
      <button
        type='button'
        aria-label={ariaLabel}
        aria-haspopup='listbox'
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className='flex w-full items-center justify-between gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 transition-colors hover:border-emerald-500/40 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-emerald-500/40'
      >
        <span className='truncate'>{current?.label ?? ''}</span>
        <svg
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth='2'
          strokeLinecap='round'
          strokeLinejoin='round'
          className={`h-4 w-4 shrink-0 text-gray-500 transition-transform dark:text-zinc-400 ${open ? 'rotate-180' : ''}`}
          aria-hidden='true'
        >
          <path d='m6 9 6 6 6-6' />
        </svg>
      </button>
      {open && (
        <ul
          role='listbox'
          aria-label={ariaLabel}
          className='absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900'
        >
          {options.map((item) => {
            const selected = item.value === value;
            return (
              <li key={item.value}>
                <button
                  type='button'
                  role='option'
                  aria-selected={selected}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? 'bg-emerald-50 font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'text-gray-700 hover:bg-gray-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  }`}
                >
                  {item.label}
                  {selected && (
                    <svg
                      viewBox='0 0 24 24'
                      fill='none'
                      stroke='currentColor'
                      strokeWidth='2.5'
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      className='h-3.5 w-3.5 shrink-0'
                      aria-hidden='true'
                    >
                      <path d='M20 6 9 17l-5-5' />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default SelectMenu;
