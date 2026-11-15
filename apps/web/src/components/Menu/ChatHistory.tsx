import React, { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import ChatIcon from '@icon/ChatIcon';
import CrossIcon from '@icon/CrossIcon';
import TickIcon from '@icon/TickIcon';
import useStore from '@store/store';
import { clearArtifactState } from '@utils/artifactState';
import { ChatInterface } from '@type/chat';

// Shared selection set for Ctrl+click multi-select across all chat rows
// (rows render in both ChatHistoryList and ChatFolder).
interface ChatSelectionState {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  clear: () => void;
}

const useChatSelection = create<ChatSelectionState>((set) => ({
  selectedIds: new Set<string>(),
  toggle: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clear: () => set({ selectedIds: new Set<string>() }),
}));

const deleteChatIds = (
  ids: string[],
  setChats: (chats: ChatInterface[]) => void,
  setCurrentChatIndex: (index: number) => void
) => {
  const state = useStore.getState();
  if (!state.chats || ids.length === 0) return;

  const idSet = new Set(ids);
  const prevActiveId = state.chats[state.currentChatIndex]?.id;

  const updatedChats = state.chats
    .filter((chat) => {
      const remove = idSet.has(chat.id);
      if (remove) clearArtifactState(chat.id);
      return !remove;
    })
    .map((chat) => JSON.parse(JSON.stringify(chat)));

  if (updatedChats.length > 0) {
    const newIndex = updatedChats.findIndex((chat) => chat.id === prevActiveId);
    setCurrentChatIndex(newIndex === -1 ? 0 : newIndex);
    setChats(updatedChats);
  } else {
    setCurrentChatIndex(-1);
    setChats([]);
  }
};

const ChatHistoryClass = {
  normal:
    'flex py-1 px-2 max-md:py-2.5 max-md:px-3 items-center gap-2 relative rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink break-all hover:pr-4 group transition-all',
  active:
    'flex py-1 px-2 max-md:py-2.5 max-md:px-3 items-center gap-2 relative rounded-lg break-all pr-14 bg-surface border border-surface-line text-ink shadow-soft group transition-all',
};

const ChatHistory = React.memo(
  ({ title, chatIndex }: { title: string; chatIndex: number }) => {
    const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
    const setChats = useStore((state) => state.setChats);
    const active = useStore((state) => state.currentChatIndex === chatIndex);
    const generating = useStore((state) => state.generating);

    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [_title, _setTitle] = useState<string>(title);
    const inputRef = useRef<HTMLInputElement>(null);

    const chatId = useStore((state) => state.chats?.[chatIndex]?.id);
    const isSelected = useChatSelection((state) =>
      chatId ? state.selectedIds.has(chatId) : false
    );
    const toggleSelect = useChatSelection((state) => state.toggle);
    const clearSelection = useChatSelection((state) => state.clear);

    const editTitle = () => {
      const updatedChats = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedChats[chatIndex].title = _title;
      setChats(updatedChats);
      setIsEdit(false);
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (generating) return;
      if (isSelected && chatId) {
        const ids = Array.from(useChatSelection.getState().selectedIds);
        clearSelection();
        deleteChatIds(ids, setChats, setCurrentChatIndex);
      } else {
        clearSelection();
        if (chatId) deleteChatIds([chatId], setChats, setCurrentChatIndex);
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editTitle();
      }
    };

    const handleTick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      editTitle();
    };

    const handleCross = () => {
      setIsEdit(false);
    };

    const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('chatIndex', String(chatIndex));
      }
    };

    useEffect(() => {
      if (inputRef && inputRef.current) inputRef.current.focus();
    }, [isEdit]);

    return (
      <a
        className={`${
          active ? ChatHistoryClass.active : ChatHistoryClass.normal
        } ${
          isSelected
            ? '!bg-brand-50 !text-ink !border !border-brand-300 dark:!bg-brand-500/15 dark:!text-brand-200 dark:!border-brand-500/40'
            : ''
        } ${
          generating
            ? 'cursor-not-allowed opacity-40'
            : 'cursor-pointer opacity-100'
        }`}
        onClick={(e) => {
          if (generating) return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (chatId) toggleSelect(chatId);
            return;
          }
          clearSelection();
          setCurrentChatIndex(chatIndex);
        }}
        onContextMenu={handleContextMenu}
        onDoubleClick={(e) => {
          e.preventDefault();
          if (!generating) {
            _setTitle(title);
            setIsEdit(true);
          }
        }}
        draggable
        onDragStart={handleDragStart}
      >
        <ChatIcon />
        <div
          className='min-w-0 flex-1 truncate text-[13px] max-md:text-sm leading-5'
          title={title}
        >
          {isEdit ? (
            <input
              type='text'
              className='focus:outline-brand-400 text-[13px] max-md:text-sm border-none bg-transparent p-0 m-0 w-full'
              value={_title}
              onChange={(e) => {
                _setTitle(e.target.value);
              }}
              onKeyDown={handleKeyDown}
              ref={inputRef}
            />
          ) : (
            _title
          )}

        </div>
        {isEdit && (
          <div className='absolute flex right-1 z-10 text-ink-muted visible scale-90'>
            <button
              className="relative p-1 after:absolute after:-inset-3 after:content-[''] hover:text-brand-600"
              onClick={handleTick}
              aria-label='confirm'
            >
              <TickIcon />
            </button>
            <button
              className="relative p-1 after:absolute after:-inset-3 after:content-[''] hover:text-ink"
              onClick={handleCross}
              aria-label='cancel'
            >
              <CrossIcon />
            </button>
          </div>
        )}
      </a>
    );
  }
);

export default ChatHistory;
