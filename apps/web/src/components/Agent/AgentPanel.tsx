import React from 'react';
import { createPortal } from 'react-dom';
import { agents } from '@constants/agents';
import { useAgentSelection } from '@store/agentSelection';
import AgentTools from './AgentTools';

const AgentPanel = () => {
  const activeAgentId = useAgentSelection((s) => s.activeAgentId);
  const panelOpen = useAgentSelection((s) => s.panelOpen);
  const setPanelOpen = useAgentSelection((s) => s.setPanelOpen);
  const setPickerOpen = useAgentSelection((s) => s.setPickerOpen);

  if (!panelOpen || !activeAgentId) return null;
  const agent = agents.find((a) => a.id === activeAgentId);
  if (!agent) return null;

  return createPortal(
    <div
      className='fixed inset-0 z-[900] flex flex-col bg-surface dark:bg-[#0b0f0e]'
      role='dialog'
      aria-modal='true'
      aria-label={`${agent.name} tools`}
    >
      <div className='flex items-center gap-2 border-b border-surface-line px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]'>
        <button
          type='button'
          aria-label='back to chat'
          className='flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5'
          onClick={() => setPanelOpen(false)}
        >
          ←
        </button>
        <div className='min-w-0 flex-1'>
          <div className='truncate text-sm font-semibold text-ink'>{agent.name}</div>
          <div className='truncate text-xs text-ink-muted'>{agent.persona}</div>
        </div>
        <button
          type='button'
          aria-label='switch agent'
          className='flex h-12 items-center rounded-full px-3 text-xs font-medium text-ink-soft hover:bg-ink/5'
          onClick={() => setPickerOpen(true)}
        >
          Switch
        </button>
      </div>
      <div className='min-h-0 flex-1 overflow-y-auto'>
        <AgentTools agentId={agent.id} />
      </div>
    </div>,
    document.body
  );
};

export default AgentPanel;
