import { supabase } from '@api/supabase';
import { fetchGuestVoiceTrial, startGuestVoice } from '@api/api';
import useAuthGateStore from '@store/auth-gate-store';
import useGuestVoiceStore, { markGuestTrialOver } from '@store/guest-voice-store';
import useVoiceStore from '@store/voice-store';

// Reads the session and, for guests only, the lifetime voice balance.
export const refreshGuestTrial = async (): Promise<void> => {
  if (!supabase) return;
  const { data } = await supabase.auth.getSession();
  const isGuest = !!data.session?.user.is_anonymous;
  useGuestVoiceStore.getState().setGuest(isGuest);
  if (!isGuest) return;
  const remaining = await fetchGuestVoiceTrial().catch(() => null);
  if (remaining !== null) useGuestVoiceStore.getState().setRemaining(remaining);
};

// Every voice entry point (mic button, voice toggle) goes through here.
// Signed-out visitors get the sign-in prompt, signed-in accounts go straight through,
// and guests must hold trial time. The server records the start without charging any time.
export const gateVoiceStart = async (action: () => void | Promise<void>): Promise<void> => {
  const { data } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
  const session = data.session;
  if (!session) return useAuthGateStore.getState().open('Sign in to use voice mode.');
  if (!session.user.is_anonymous) return action();

  useGuestVoiceStore.getState().setGuest(true);
  const result = await startGuestVoice().catch(() => null);
  if (result?.ok && result.remainingSeconds > 0) {
    useGuestVoiceStore.getState().setRemaining(result.remainingSeconds);
    return action();
  }
  if (result?.ok || result?.code === 'GUEST_VOICE_LIMIT') return markGuestTrialOver();
  useVoiceStore.getState().setError('Voice could not start. Check your connection and try again.');
};
