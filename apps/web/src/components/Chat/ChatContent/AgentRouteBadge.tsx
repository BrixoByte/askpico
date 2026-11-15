import React, { useState } from 'react';
import useStore from '@store/store';
import { agents } from '@constants/agents';
import useSubmit from '@hooks/useSubmit';
import { setRouteBypass } from '@utils/routeBypass';

const AGENT_NAME: Record<string, string> = Object.fromEntries(
  agents.map((a) => [a.id, a.name])
);

// Subtle badge shown under the latest assistant reply when the router picked a
// specialist. "Core instead" re-answers the same user message via core chat.
const AgentRouteBadge = () => {
  const [busy, setBusy] = useState(false);
  const { handleSubmit } = useSubmit();
  const currentChatIndex = useStore((s) => s.currentChatIndex);
  const chat = useStore((s) =>
    s.chats && currentChatIndex >= 0 ? s.chats[currentChatIndex] : null
  );
  const generating = useStore((s) => s.generating);

  const agentId = chat?.lastAgentId ?? null;
  const last = chat?.messages?.[chat.messages.length - 1];
  if (!agentId || !chat || last?.role !== 'assistant' || generating) return null;

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
    <div className='mx-auto mt-1 flex w-full max-w-3xl items-center gap-2 px-4 text-xs text-gray-400 dark:text-gray-500'>
      <span
        className='rounded-full border border-gray-200 px-2 py-0.5 dark:border-gray-700'
        title='Pico routed this message to a specialist agent'
      >
        {name}
      </span>
      <button
        type='button'
        onClick={answerWithCore}
        disabled={busy}
        className='min-h-[32px] rounded-full px-2 py-0.5 text-left underline-offset-2 hover:underline disabled:opacity-50'
      >
        {busy ? 'Answering…' : 'Answer with core chat instead'}
      </button>
    </div>
  );
};

export default AgentRouteBadge;
