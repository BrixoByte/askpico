import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { v4 as uuidv4 } from 'uuid';

import { DotsIcon } from '@icon/ui';
import useStore from '@store/store';
import downloadFile from '@utils/downloadFile';
import { ChatInterface, Folder, FolderCollection } from '@type/chat';
import { useChatSelection } from './chatSelection';

interface ChatRowMenuProps {
  chat: ChatInterface | undefined;
  chatIndex: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRename: () => void;
  onDelete: (ids: string[]) => void;
  disabled?: boolean;
}

const itemClass =
  'flex min-h-[48px] w-full items-center rounded-lg px-3 text-left text-sm text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink';

const Dialog = ({
  children,
  label,
  onClose,
}: {
  children: React.ReactNode;
  label: string;
  onClose: () => void;
}) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className='fixed inset-0 z-[1100] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm'
      role='dialog'
      aria-modal='true'
      aria-label={label}
      onMouseDown={onClose}
    >
      <div
        className='w-full max-w-sm rounded-2xl border border-surface-line bg-surface p-4 shadow-2xl'
        onMouseDown={(e) => e.stopPropagation()
        }
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

const DeleteConfirmDialog = ({
  count,
  names,
  onCancel,
  onConfirm,
}: {
  count: number;
  names: string[];
  onCancel: () => void;
  onConfirm: () => void;
}) => (
  <Dialog label='Delete chat' onClose={onCancel}>
    <h3 className='text-sm font-semibold text-ink'>Delete chat?</h3>
    <p className='mt-1 text-sm text-ink-muted'>
      {count === 1
        ? `"${names[0]}" will be permanently deleted.`
        : `${count} chats will be permanently deleted.`}
    </p>
    <div className='mt-4 flex justify-end gap-2'>
      <button
        type='button'
        onClick={onCancel}
        className='min-h-[48px] rounded-xl px-4 text-sm font-medium text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink'
      >
        Cancel
      </button>
      <button
        type='button'
        onClick={onConfirm}
        className='min-h-[48px] rounded-xl bg-red-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90'
      >
        Delete
      </button>
    </div>
  </Dialog>
);

const MoveToFolderDialog = ({
  chatIndex,
  currentFolder,
  onClose,
}: {
  chatIndex: number;
  currentFolder?: string;
  onClose: () => void;
}) => {
  const folders = useStore((state) => state.folders);
  const setFolders = useStore((state) => state.setFolders);
  const setChats = useStore((state) => state.setChats);
  const [newName, setNewName] = useState('');

  const sorted = Object.values(folders ?? {}).sort((a, b) => a.order - b.order);

  const moveTo = (folderId?: string) => {
    const updatedChats: ChatInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().chats ?? [])
    );
    if (updatedChats[chatIndex]) {
      if (folderId) updatedChats[chatIndex].folder = folderId;
      else delete updatedChats[chatIndex].folder;
      setChats(updatedChats);
    }
    onClose();
  };

  const createFolder = () => {
    const name = newName.trim();
    if (!name) return;
    const existing = useStore.getState().folders ?? {};
    if (Object.values(existing).some((f) => f.name === name)) {
      moveTo(
        Object.values(existing).find((f) => f.name === name)?.id
      );
      return;
    }
    const updated: FolderCollection = JSON.parse(JSON.stringify(existing));
    const id = uuidv4();
    const folder: Folder = { id, name, expanded: true, order: 0 };
    Object.values(updated).forEach((f) => {
      f.order += 1;
    });
    setFolders({ [id]: folder, ...updated });
    moveTo(id);
  };

  return (
    <Dialog label='Move to folder' onClose={onClose}>
      <h3 className='text-sm font-semibold text-ink'>Move to folder</h3>
      <div className='mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto'>
        <button type='button' className={itemClass} onClick={() => moveTo()}>
          No folder
          {!currentFolder && <span className='ml-auto text-ink-muted'>✓</span>}
        </button>
        {sorted.map((folder) => (
          <button
            key={folder.id}
            type='button'
            className={itemClass}
            onClick={() => moveTo(folder.id)}
          >
            <span className='min-w-0 flex-1 truncate'>{folder.name}</span>
            {currentFolder === folder.id && (
              <span className='ml-auto text-ink-muted'>✓</span>
            )}
          </button>
        ))}
      </div>
      <div className='mt-3 flex items-center gap-2 border-t border-surface-line pt-3'>
        <input
          type='text'
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              createFolder();
            }
          }}
          placeholder='New folder name'
          aria-label='New folder name'
          className='h-11 min-w-0 flex-1 rounded-xl border border-surface-line bg-transparent px-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none'
        />
        <button
          type='button'
          onClick={createFolder}
          disabled={!newName.trim()}
          className='min-h-[44px] rounded-xl bg-ink px-3 text-sm font-medium text-surface transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-[#9EFF00] dark:text-black'
        >
          Create
        </button>
      </div>
    </Dialog>
  );
};

const ChatRowMenu = ({
  chat,
  chatIndex,
  title,
  open,
  onOpenChange,
  onRename,
  onDelete,
  disabled = false,
}: ChatRowMenuProps) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [dialog, setDialog] = useState<'delete' | 'folder' | null>(null);
  const chats = useStore((state) => state.chats);
  const chatTitles = React.useMemo(() => {
    const map: Record<string, string> = {};
    (chats ?? []).forEach((c) => {
      map[c.id] = c.title;
    });
    return map;
  }, [chats]);
  const selectedIds = useChatSelection((s) => s.selectedIds);
  const chatId = chat?.id;
  const isMultiSelected = chatId ? selectedIds.has(chatId) && selectedIds.size > 1 : false;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onOpenChange]);

  const deleteIds = isMultiSelected
    ? Array.from(selectedIds)
    : chatId
      ? [chatId]
      : [];

  const exportChat = () => {
    if (!chat) return;
    const safe = (chat.title || 'chat').replace(/[\\/:*?"<>|]/g, '_').slice(0, 80);
    downloadFile(
      { chats: [chat], folders: {}, version: 1 },
      `${safe}.json`
    );
    onOpenChange(false);
  };

  return (
    <div ref={wrapRef} className='relative shrink-0'>
      <button
        type='button'
        className="relative flex h-12 w-12 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink"
        onClick={(e) => {
          e.stopPropagation();
          onOpenChange(!open);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`Chat options for ${title}`}
        aria-haspopup='menu'
        aria-expanded={open}
        disabled={disabled}
      >
        <DotsIcon className='h-5 w-5' />
      </button>
      {open && (
        <div
          role='menu'
          onPointerDown={(e) => e.stopPropagation()}
          className='absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-surface-line bg-surface p-1.5 shadow-card'
        >
          <button
            type='button'
            role='menuitem'
            className={itemClass}
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              onRename();
            }}
          >
            Rename
          </button>
          <button
            type='button'
            role='menuitem'
            className={itemClass}
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              setDialog('folder');
            }}
          >
            Move to folder
          </button>
          <button
            type='button'
            role='menuitem'
            className={itemClass}
            onClick={(e) => {
              e.stopPropagation();
              exportChat();
            }}
          >
            Export chat
          </button>
          <button
            type='button'
            role='menuitem'
            className={`${itemClass} text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenChange(false);
              setDialog('delete');
            }}
          >
            Delete
          </button>
        </div>
      )}
      {dialog === 'delete' && (
        <DeleteConfirmDialog
          count={deleteIds.length}
          names={deleteIds
            .map((id) => chatTitles[id] ?? '')
            .slice(0, 3)}
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            onOpenChange(false);
            onDelete(deleteIds);
          }}
        />
      )}
      {dialog === 'folder' && (
        <MoveToFolderDialog
          chatIndex={chatIndex}
          currentFolder={chat?.folder}
          onClose={() => {
            setDialog(null);
            onOpenChange(false);
          }}
        />
      )}
    </div>
  );
};

export default ChatRowMenu;
