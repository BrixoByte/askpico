import { useEffect, useRef } from 'react';
import { sendGuestVoiceHeartbeat } from '@api/api';
import { supabase } from '@api/supabase';
import useGuestVoiceStore, { markGuestTrialOver } from '@store/guest-voice-store';
import useVoiceStore from '@store/voice-store';
import { refreshGuestTrial } from '@voice/guestVoiceGate';
import {
  adoptServerRemaining,
  claimActiveSeconds,
  pauseTrialTimer,
  refundClaim,
  remainingSeconds,
  resumeTrialTimer,
  startTrialTimer,
  type TrialTimer,
} from '@voice/guestVoiceTimer';

// Matches HEARTBEAT_SECONDS on the server.
const HEARTBEAT_MS = 30_000;
const TICK_MS = 1000;

// Runs the guest trial clock while voice is on. It counts active time, reports it on each
// heartbeat, pauses while the app is in the background, and ends voice cleanly at zero.
const useGuestVoiceTrial = () => {
  const voiceMode = useVoiceStore((state) => state.voiceMode);
  const isGuest = useGuestVoiceStore((state) => state.isGuest);
  const timer = useRef<TrialTimer | null>(null);

  // The guest session is often created after mount (the ?guest=1 hand-off), so refresh on every auth change.
  useEffect(() => {
    void refreshGuestTrial();
    const subscription = supabase?.auth.onAuthStateChange(() => void refreshGuestTrial());
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!voiceMode || !isGuest) return;
    const start = useGuestVoiceStore.getState().remaining;
    if (start === null || start <= 0) return;
    timer.current = startTrialTimer(start, Date.now());

    // Sends the whole seconds of active time not yet reported. The server caps what it accepts.
    // A failed heartbeat refunds the claim so the next one can report it again — otherwise
    // a single dropped request would silently lose those seconds (the Round 25 billing bug).
    const flush = async (reason: 'beat' | 'pause' | 'end' = 'beat') => {
      const current = timer.current;
      if (!current) return;
      const { claim, timer: next } = claimActiveSeconds(current, Date.now());
      if (claim === 0) return;
      timer.current = next;
      const result = await sendGuestVoiceHeartbeat(claim, reason).catch(() => null);
      if (result?.ok) {
        if (timer.current) {
          timer.current = adoptServerRemaining(timer.current, result.remainingSeconds);
          useGuestVoiceStore.getState().setRemaining(remainingSeconds(timer.current, Date.now()));
        } else {
          // The session already ended; keep the sidebar in sync with the server's balance.
          useGuestVoiceStore.getState().setRemaining(result.remainingSeconds);
        }
      } else if (result?.code === 'GUEST_VOICE_LIMIT') {
        markGuestTrialOver();
      } else if (timer.current) {
        timer.current = refundClaim(timer.current, claim);
        useGuestVoiceStore.getState().setRemaining(remainingSeconds(timer.current, Date.now()));
      }
    };

    const publish = () => {
      if (!timer.current) return;
      const left = remainingSeconds(timer.current, Date.now());
      useGuestVoiceStore.getState().setRemaining(left);
      if (left === 0) markGuestTrialOver();
    };

    const onVisibility = () => {
      if (!timer.current) return;
      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        timer.current = pauseTrialTimer(timer.current, now);
        void flush('pause');
      } else {
        timer.current = resumeTrialTimer(timer.current, now);
      }
    };

    const tick = window.setInterval(publish, TICK_MS);
    const beat = window.setInterval(() => void flush('beat'), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisibility);
      void flush('end');
      timer.current = null;
    };
  }, [voiceMode, isGuest]);
};

export default useGuestVoiceTrial;
