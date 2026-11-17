import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import useStore from '@store/store';
import { AgentId, AgentToolId, agents } from '@constants/agents';
import useSubmit from '@hooks/useSubmit';
import { setRouteBypass } from '@utils/routeBypass';
import { matchTool } from '@utils/toolPhrases';
import AgentTools, { toolLabels } from '@components/Agent/AgentTools';

const AGENT_NAME: Record<string, string> = Object.fromEntries(
  agents.map((a) => [a.id, a.name])
);

// Subtle badge shown under the latest assistant reply when the router picked a
// specialist. "Core instead" re-answers the same user message via core chat.
// When the user's message clearly names one of that agent's tools, an inline
// "Open <tool>" card is offered. It never opens by itself.
const AgentRouteBadge = () => {
  const [busy, setBusy] = useState(false);
  const [openTool, setOpenTool] = useState<AgentToolId | null>(null);
  const { handleSubmit } = useSubmit();
  const currentChatIndex = useStore((s) => s.currentChatIndex);
  const chat = useStore((s) =>
    s.chats && currentChatIndex >= 0 ? s.chats[currentChatIndex] : null
  );
  const generating = useStore((s) => s.generating);

  const routedAgentId = chat?.lastAgentId ?? null;
  const last = chat?.messages?.[chat.messages.length - 1];
  if (!chat || last?.role !== 'assistant' || generating) return null;

  // The tool match is independent of the agent route: a tool card can appear even
  // when the router chose core or another agent. The badge shows the tool's owner.
  const lastUser = [...chat.messages].reverse().find((m) => m.role === 'user')?.content;
  const tool = typeof lastUser === 'string' ? matchTool(lastUser) : null;
  const owner = tool ? agents.find((a) => a.tools.includes(tool)) : undefined;
  const agentId = owner?.id ?? routedAgentId;
  if (!agentId) return null;

  const name = AGENT_NAME[agentId] ?? `${agentId} Agent`;

  const answerWithCore = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const chats = JSON.parse(JSON.stringify(useStore.getState().chats));
      const target = chats[currentChatIndex];
      // Drop the specialist reply; the user turn stays so handleSubmit resends it.
      while (target.messages.length && target.messages[target.messages.length - 1].role === 'assistant') {
        target.messages.pop();
      }
      target.lastAgentId = null;
      useStore.getState().setChats(chats);
      setRouteBypass(true);
      await handleSubmit();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className='mx-auto mt-1 flex w-full max-w-3xl items-center gap-2 px-4 text-xs text-gray-400 dark:text-gray-500'>
        <span
          className='rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700'
          title='Pico routed this message to a specialist agent'
        >
          {name}
        </span>
        {routedAgentId && (
          <button
            type='button'
            onClick={answerWithCore}
            disabled={busy}
            className='min-h-[32px] rounded-full px-2 py-0.5 text-left underline-offset-2 hover:underline disabled:opacity-50'
          >
            {busy ? 'Answering…' : 'Answer with core chat instead'}
          </button>
        )}
      </div>
      {tool && (
        <div className='mx-auto mt-1 flex w-full max-w-3xl px-4'>
          <button
            type='button'
            onClick={() => setOpenTool(tool)}
            aria-label={`Open ${toolLabels[tool]} tool`}
            className='min-h-[48px] rounded-xl border border-surface-line bg-surface px-4 text-sm font-medium text-ink shadow-soft'
          >
            Open {toolLabels[tool]}
          </button>
        </div>
      )}
      {openTool &&
        createPortal(
          <div
            className='fixed inset-0 z-[900] flex flex-col bg-surface dark:bg-[#0b0f0e]'
            role='dialog'
            aria-modal='true'
            aria-label={`${toolLabels[openTool]} tool`}
          >
            <div className='flex items-center gap-2 border-b border-surface-line px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]'>
              <button
                type='button'
                aria-label='Back to chat'
                className='flex h-12 w-12 items-center justify-center rounded-full text-ink-soft hover:bg-ink/5'
                onClick={() => setOpenTool(null)}
              >
                ←
              </button>
              <div className='min-w-0 flex-1 truncate text-sm font-semibold text-ink'>{toolLabels[openTool]}</div>
            </div>
            <div className='min-h-0 flex-1 overflow-y-auto'>
              <AgentTools agentId={agentId as AgentId} initialTool={openTool} />
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default AgentRouteBadge;
