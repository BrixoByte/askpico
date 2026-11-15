import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { CompassIcon, FileIcon, LibraryIcon, SparkleIcon, BulbIcon } from '@icon/ui';
import { useAgentSelection } from '@store/agentSelection';

const items: { label: string; icon: React.ReactNode }[] = [
  { label: 'Explore', icon: <CompassIcon className='h-4 w-4' /> },
  { label: 'Library', icon: <LibraryIcon className='h-4 w-4' /> },
  { label: 'Projects', icon: <FileIcon className='h-4 w-4' /> },
  { label: 'Studio', icon: <SparkleIcon className='h-4 w-4' /> },
];

const agentIcon = <BulbIcon className='h-4 w-4' />;

const ComingSoonPopup = ({ label, onClose }: { label: string; onClose: () => void }) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm'
      onMouseDown={onClose}
    >
      <div
        className='w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 text-center shadow-2xl dark:border-zinc-800 dark:bg-[#0B0F0E]'
        onMouseDown={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
      >
        <h3 className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>{label} is coming soon</h3>
        <p className='mt-2 text-sm text-zinc-600 dark:text-zinc-400'>
          We are still building this feature. Stay tuned.
        </p>
        <button
          type='button'
          onClick={onClose}
          className='mt-6 w-full rounded-xl bg-[#84cc16] px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#a3e635]'
        >
          Got it
        </button>
      </div>
    </div>,
    document.body
  );
};

const SidebarNav = () => {
  const [comingSoon, setComingSoon] = useState<string | null>(null);
  const setPickerOpen = useAgentSelection((s) => s.setPickerOpen);
  const activeAgentId = useAgentSelection((s) => s.activeAgentId);

  return (
    <>
      <div className='flex flex-col gap-0 pb-1'>
        <button
          type='button'
          className='sidebar-link w-full'
          onClick={() => setPickerOpen(true)}
        >
          <span className='text-ink-muted'>{agentIcon}</span>
          Agents{activeAgentId ? ' •' : ''}
        </button>
        {items.map((item) => (
          <button
            key={item.label}
            type='button'
            className='sidebar-link w-full'
            onClick={() => setComingSoon(item.label)}
          >
            <span className='text-ink-muted'>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>
      {comingSoon && (
        <ComingSoonPopup label={comingSoon} onClose={() => setComingSoon(null)} />
      )}
    </>
  );
};

export default SidebarNav;
