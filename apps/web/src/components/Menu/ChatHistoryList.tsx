import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SearchModal from './SearchModal';
import SidebarNav from './SidebarNav';
import ChatHistory from './ChatHistory';
import NewChat from './NewChat';

import { SearchIcon } from '@icon/ui';

import { ChatHistoryInterface, ChatInterface } from '@type/chat';

import useStore from '@store/store';
import { useAgentSelection } from '@store/agentSelection';
import { useIsSignedIn } from '@utils/authGate';

const MAX_RECENT_CHATS = 6;

const getRecency = (chat: { updatedAt?: number; createdAt?: number }) =>
  chat.updatedAt ?? chat.createdAt ?? 0;

const ChatHistoryList = ({ fillHeight = true }: { fillHeight?: boolean }) => {
  const { t } = useTranslation();
  const [noChatFolders, setNoChatFolders] = useState<ChatHistoryInterface[]>(
    []
  );
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const signedIn = useIsSignedIn();
  const activeAgentId = useAgentSelection((s) => s.activeAgentId);

  const updateFolders = useRef(() => {
    const _noFolders: ChatHistoryInterface[] = [];
    const chats = useStore.getState().chats;

    if (chats) {
      chats.forEach((chat: ChatInterface, index: number) => {
        _noFolders.push({
          title: chat.title,
          index: index,
          id: chat.id,
          createdAt: chat.createdAt,
          updatedAt: chat.updatedAt,
          lastAgentId: chat.lastAgentId ?? null,
        });
      });
    }

    _noFolders.sort((a, b) => getRecency(b) - getRecency(a));
    setNoChatFolders(_noFolders.slice(0, MAX_RECENT_CHATS));
  }).current;

  useEffect(() => {
    updateFolders();

    return useStore.subscribe((state, prev) => {
      if (state.generating) return;
      if (
        state.chats !== prev.chats ||
        state.generating !== prev.generating
      ) {
        updateFolders();
      }
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`flex flex-col ${fillHeight ? 'min-h-0 flex-1' : ''}`}>
      <div className='mb-2 flex items-center gap-2'>
        <div className='min-w-0 flex-1'>
          <NewChat />
        </div>
        {signedIn && (
          <button
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-surface-line bg-surface text-ink-muted transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:text-ink"
            onClick={() => setIsSearchOpen(true)}
            aria-label='search chats'
          >
            <SearchIcon className='h-4 w-4' />
          </button>
        )}
      </div>
      <SearchModal
        isOpen={signedIn && isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
      <div className={`flex flex-col ${fillHeight ? 'min-h-0 flex-1 overflow-y-auto' : ''} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}>
        <SidebarNav />
        {signedIn && (
          <div id='chat-history-scroll' className='pt-0.5'>
            <ChatSectionList
              chats={
                activeAgentId
                  ? noChatFolders.filter((c) => c.lastAgentId === activeAgentId)
                  : noChatFolders
              }
              onSeeAll={() => setIsSearchOpen(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const ChatSectionList = ({
  chats,
  onSeeAll,
}: {
  chats: ChatHistoryInterface[];
  onSeeAll: () => void;
}) => {
  return (
    <div className='mb-2'>
      <div className='sticky top-0 z-10 flex items-center justify-between bg-transparent px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-muted'>
        <span>Recent</span>
        <button
          type='button'
          onClick={onSeeAll}
          className='-mx-1 inline-flex min-h-[48px] items-center px-1 normal-case tracking-normal text-zinc-400 transition-colors hover:text-[#8AE000] dark:hover:text-[#9EFF00]'
        >
          See All &rarr;
        </button>
      </div>
      <div className='flex flex-col gap-1.5'>
        {chats.map((chat) => (
          <ChatHistory
            title={chat.title}
            chatIndex={chat.index}
            key={`${chat.title}-${chat.index}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ChatHistoryList;
