import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import SearchModal from './SearchModal';
import ChatHistory from './ChatHistory';
import ChatFolder from './ChatFolder';
import NewChat from './NewChat';

import { SearchIcon } from '@icon/ui';

import { ChatHistoryInterface, ChatInterface, Folder } from '@type/chat';

import useStore from '@store/store';
import { useIsSignedIn } from '@utils/authGate';


const getRecency = (chat: { updatedAt?: number; createdAt?: number }) =>
  chat.updatedAt ?? chat.createdAt ?? 0;

const ChatHistoryList = ({ fillHeight = true }: { fillHeight?: boolean }) => {
  const { t } = useTranslation();
  const [noChatFolders, setNoChatFolders] = useState<ChatHistoryInterface[]>(
    []
  );
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const signedIn = useIsSignedIn();
  const chats = useStore((state) => state.chats);
  const folders = useStore((state) => state.folders);

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
    setNoChatFolders(_noFolders.filter((c) => !chats?.[c.index]?.folder));
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
        {signedIn && folders && Object.keys(folders).length > 0 && (
          <FolderSection folders={folders} chats={chats ?? []} />
        )}
        {signedIn && (
          <div id='chat-history-scroll' className='pt-0.5'>
            <ChatSectionList
              chats={noChatFolders}
              onSeeAll={() => setIsSearchOpen(true)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

const FolderSection = ({
  folders,
  chats,
}: {
  folders: Record<string, Folder>;
  chats: ChatInterface[];
}) => {
  const sorted = Object.values(folders).sort((a, b) => a.order - b.order);
  return (
    <div className='mb-2'>
      {sorted.map((folder) => {
        const folderChats: ChatHistoryInterface[] = chats
          .map((chat, index) => ({
            title: chat.title,
            index,
            id: chat.id,
            createdAt: chat.createdAt,
            updatedAt: chat.updatedAt,
            lastAgentId: chat.lastAgentId ?? null,
          }))
          .filter((c) => chats[c.index]?.folder === folder.id)
          .sort((a, b) => getRecency(b) - getRecency(a));
        return (
          <ChatFolder
            key={folder.id}
            folderId={folder.id}
            folderChats={folderChats}
          />
        );
      })}
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
