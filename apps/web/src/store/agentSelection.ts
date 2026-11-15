import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AgentId } from '@constants/agents';

interface AgentSelectionState {
  activeAgentId: AgentId | null;
  panelOpen: boolean;
  pickerOpen: boolean;
  setActiveAgent: (id: AgentId | null) => void;
  setPanelOpen: (open: boolean) => void;
  setPickerOpen: (open: boolean) => void;
}

export const useAgentSelection = create<AgentSelectionState>()(
  persist(
    (set) => ({
      activeAgentId: null,
      panelOpen: false,
      pickerOpen: false,
      setActiveAgent: (id) => set({ activeAgentId: id, panelOpen: id !== null }),
      setPanelOpen: (open) => set({ panelOpen: open }),
      setPickerOpen: (open) => set({ pickerOpen: open }),
    }),
    {
      name: 'pico-agent-selection',
      partialize: (s) => ({ activeAgentId: s.activeAgentId }),
    }
  )
);
