import { create } from 'zustand';

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

export const useChatSelection = create<ChatSelectionState>((set) => ({
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

export const deleteChatIds = (
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
