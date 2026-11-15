import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';
import { MEMORY_MAX_ITEMS, validateMemoryText } from '@utils/memorySafety';

export interface MemoryItem {
  id: string;
  text: string;
  createdAt: number;
}

interface MemoryState {
  memoryEnabled: boolean;
  items: MemoryItem[];
  setMemoryEnabled: (enabled: boolean) => void;
  addMemory: (text: string) => string | null;
  replaceItems: (texts: string[]) => void;
  removeMemory: (id: string) => void;
  clearMemories: () => void;
}

const useMemoryStore = create<MemoryState>()(
  persist(
    (set, get) => ({
      memoryEnabled: true,
      items: [],
      setMemoryEnabled: (memoryEnabled) => set({ memoryEnabled }),
      addMemory: (text) => {
        const error = validateMemoryText(text);
        if (error) return error;
        if (get().items.length >= MEMORY_MAX_ITEMS)
          return `You can store at most ${MEMORY_MAX_ITEMS} memories.`;
        set((state) => ({
          items: [
            ...state.items,
            { id: uuid(), text: text.trim(), createdAt: Date.now() },
          ],
        }));
        return null;
      },
      replaceItems: (texts) =>
        set({
          items: texts.map((text) => ({ id: uuid(), text, createdAt: Date.now() })),
        }),
      removeMemory: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id),
        })),
      clearMemories: () => set({ items: [] }),
    }),
    { name: 'pico-memory' }
  )
);

export default useMemoryStore;
