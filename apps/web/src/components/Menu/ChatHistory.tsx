import React, { useEffect, useRef, useState } from 'react';

import ChatIcon from '@icon/ChatIcon';
import CrossIcon from '@icon/CrossIcon';
import TickIcon from '@icon/TickIcon';
import useStore from '@store/store';
import { ChatInterface } from '@type/chat';
import ChatRowMenu from './ChatRowMenu';
import { deleteChatIds, useChatSelection } from './chatSelection';

const ChatHistoryClass = {
  normal:
    'flex py-1 px-2 max-md:py-2.5 max-md:px-3 items-center gap-2 relative rounded-lg text-ink-soft hover:bg-ink/5 hover:text-ink break-all hover:pr-4 group transition-all',
  active:
    'flex py-1 px-2 max-md:py-2.5 max-md:px-3 items-center gap-2 relative rounded-lg break-all pr-14 bg-surface border border-surface-line text-ink shadow-soft group transition-all',
};

const LONG_PRESS_MS = 500;

const ChatHistory = React.memo(
  ({ title, chatIndex }: { title: string; chatIndex: number }) => {
    const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
    const setChats = useStore((state) => state.setChats);
    const active = useStore((state) => state.currentChatIndex === chatIndex);
    const generating = useStore((state) => state.generating);
    const chat = useStore((state) => state.chats?.[chatIndex]);

    const [isEdit, setIsEdit] = useState<boolean>(false);
    const [_title, _setTitle] = useState<string>(title);
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const longPressTimer = useRef<number | null>(null);
    const suppressClick = useRef<boolean>(false);

    const chatId = chat?.id;
    const isSelected = useChatSelection((state) =>
      chatId ? state.selectedIds.has(chatId) : false
    );
    const toggleSelect = useChatSelection((state) => state.toggle);
    const clearSelection = useChatSelection((state) => state.clear);

    const cancelLongPress = () => {
      if (longPressTimer.current !== null) {
        window.clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    };

    const editTitle = () => {
      const next = _title.trim();
      if (!next || next === title) {
        setIsEdit(false);
        _setTitle(title);
        return;
      }
      const updatedChats = JSON.parse(
        JSON.stringify(useStore.getState().chats)
      );
      updatedChats[chatIndex].title = next;
      setChats(updatedChats);
      setIsEdit(false);
    };

    const startRename = () => {
      _setTitle(title);
      setIsEdit(true);
    };

    const handleDelete = (ids: string[]) => {
      clearSelection();
      deleteChatIds(ids, setChats, setCurrentChatIndex);
    };

    const handleContextMenu = (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();
      if (generating) return;
      setMenuOpen(true);
    };

    const handlePointerDown = () => {
      if (generating) return;
      cancelLongPress();
      longPressTimer.current = window.setTimeout(() => {
        longPressTimer.current = null;
        suppressClick.current = true;
        setMenuOpen(true);
      }, LONG_PRESS_MS);
    };

    const handlePointerUpOrCancel = () => cancelLongPress();

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        editTitle();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsEdit(false);
        _setTitle(title);
      }
    };

    const handleTick = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      editTitle();
    };

    const handleCross = () => {
      setIsEdit(false);
      _setTitle(title);
    };

    const handleDragStart = (e: React.DragEvent<HTMLAnchorElement>) => {
      if (e.dataTransfer) {
        e.dataTransfer.setData('chatIndex', String(chatIndex));
      }
    };

    useEffect(() => {
      return cancelLongPress;
    }, []);

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
          if (suppressClick.current) {
            suppressClick.current = false;
            return;
          }
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
          if (!generating) startRename();
        }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUpOrCancel}
        onPointerLeave={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
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
        {!isEdit && (
          <ChatRowMenu
            chat={chat as ChatInterface | undefined}
            chatIndex={chatIndex}
            title={title}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            onRename={startRename}
            onDelete={handleDelete}
            disabled={generating}
          />
        )}
      </a>
    );
  }
);

export default ChatHistory;
