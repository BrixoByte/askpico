import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { agents } from '@constants/agents';
import { useAgentSelection } from '@store/agentSelection';

const AgentPicker = () => {
  const pickerOpen = useAgentSelection((s) => s.pickerOpen);
  const setPickerOpen = useAgentSelection((s) => s.setPickerOpen);
  const setActiveAgent = useAgentSelection((s) => s.setActiveAgent);
  const activeAgentId = useAgentSelection((s) => s.activeAgentId);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickerOpen, setPickerOpen]);

  if (!pickerOpen) return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center'
      onMouseDown={() => setPickerOpen(false)}
    >
      <div
        className='max-h-[85%] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#0B0F0E] sm:rounded-3xl'
        onMouseDown={(e) => e.stopPropagation()}
        role='dialog'
        aria-modal='true'
        aria-label='Choose an agent'
      >
        <div className='mb-4 flex items-center justify-between'>
          <h3 className='text-base font-semibold text-zinc-900 dark:text-zinc-100'>Agents</h3>
          <button
            type='button'
            aria-label='close agent picker'
            className='flex h-12 w-12 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            onClick={() => setPickerOpen(false)}
          >
            ✕
          </button>
        </div>
        <div className='grid grid-cols-2 gap-2'>
          {agents.map((a) => {
            const planned = a.tools.length === 0;
            const active = a.id === activeAgentId;
            return (
              <button
                key={a.id}
                type='button'
                disabled={planned}
                onClick={() => {
                  setActiveAgent(a.id);
                  setPickerOpen(false);
                }}
                className={`flex min-h-[56px] flex-col items-start rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-[#84cc16] bg-[#84cc16]/10 dark:border-[#9EFF00] dark:bg-[#9EFF00]/10'
                    : 'border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                } ${planned ? 'opacity-50' : ''}`}
              >
                <span className='text-sm font-semibold text-zinc-900 dark:text-zinc-100'>{a.name}</span>
                <span className='text-xs text-zinc-500 dark:text-zinc-400'>
                  {planned ? 'Coming soon' : `${a.tools.length} tools`}
                </span>
              </button>
            );
          })}
        </div>
        {activeAgentId && (
          <button
            type='button'
            className='mt-4 w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900'
            onClick={() => {
              setActiveAgent(null);
              setPickerOpen(false);
            }}
          >
            Back to core chat
          </button>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AgentPicker;
