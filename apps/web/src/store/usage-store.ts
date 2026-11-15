import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Free plan daily limit for the Deep model (beta).
export const FREE_DEEP_LIMIT = 5;

const todayKey = () => new Date().toISOString().slice(0, 10);

interface UsageState {
  day: string;
  deepUsed: number;
  upgradeOpen: boolean;
  setUpgradeOpen: (open: boolean) => void;
  quotaOpen: boolean;
  setQuotaOpen: (open: boolean) => void;
  quotaKind: 'busy' | 'cap' | 'referral' | null;
  setQuotaKind: (kind: 'busy' | 'cap' | 'referral' | null) => void;
  deepRemaining: () => number;
  consumeDeep: () => boolean;
}

const useUsageStore = create<UsageState>()(
  persist(
    (set, get) => ({
      day: todayKey(),
      deepUsed: 0,
      upgradeOpen: false,
      setUpgradeOpen: (upgradeOpen) => set({ upgradeOpen }),
      quotaOpen: false,
      setQuotaOpen: (quotaOpen) => set({ quotaOpen }),
      quotaKind: null,
      setQuotaKind: (quotaKind) => set({ quotaKind }),
      deepRemaining: () => {
        const state = get();
        const used = state.day === todayKey() ? state.deepUsed : 0;
        return Math.max(0, FREE_DEEP_LIMIT - used);
      },
      consumeDeep: () => {
        const state = get();
        const used = state.day === todayKey() ? state.deepUsed : 0;
        if (used >= FREE_DEEP_LIMIT) return false;
        set({ day: todayKey(), deepUsed: used + 1 });
        return true;
      },
    }),
    {
      name: 'pico-usage',
      partialize: (state) => ({ day: state.day, deepUsed: state.deepUsed }),
    }
  )
);

export default useUsageStore;
