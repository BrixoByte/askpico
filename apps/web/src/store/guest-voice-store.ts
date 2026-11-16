import { create } from 'zustand';
import useVoiceStore from './voice-store';

export const TRIAL_OVER_MESSAGE = 'Your 2-minute voice trial is over. Sign in to keep talking.';

interface GuestVoiceState {
  // null until the session is read; false for signed-in accounts and signed-out visitors.
  isGuest: boolean | null;
  // Whole seconds left in the lifetime guest trial; null until known. 0 means used up.
  remaining: number | null;
  setGuest: (isGuest: boolean) => void;
  setRemaining: (remaining: number) => void;
}

const useGuestVoiceStore = create<GuestVoiceState>((set) => ({
  isGuest: null,
  remaining: null,
  setGuest: (isGuest) => set({ isGuest }),
  setRemaining: (remaining) => set({ remaining: Math.max(0, remaining) }),
}));

// Trial used up: zero the balance, stop voice cleanly, and keep the transcript and text chat.
// setVoiceMode(false) clears the voice error, so the message is set afterwards.
export const markGuestTrialOver = () => {
  useGuestVoiceStore.getState().setRemaining(0);
  useVoiceStore.getState().setVoiceMode(false);
  useVoiceStore.getState().setError(TRIAL_OVER_MESSAGE);
};

export default useGuestVoiceStore;
