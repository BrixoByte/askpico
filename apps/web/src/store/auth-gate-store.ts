import { create } from 'zustand';

interface AuthGateState {
  message: string | null;
  open: (message: string) => void;
  close: () => void;
}

const useAuthGateStore = create<AuthGateState>((set) => ({
  message: null,
  open: (message) => set({ message }),
  close: () => set({ message: null }),
}));

export default useAuthGateStore;
