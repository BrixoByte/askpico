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
    const flush = async () => {
      const current = timer.current;
      if (!current) return;
      const { claim, timer: next } = claimActiveSeconds(current, Date.now());
      timer.current = next;
      if (claim === 0) return;
      const result = await sendGuestVoiceHeartbeat(claim).catch(() => null);
      if (result?.ok) {
        if (timer.current) timer.current = adoptServerRemaining(timer.current, result.remainingSeconds);
        if (timer.current) useGuestVoiceStore.getState().setRemaining(remainingSeconds(timer.current, Date.now()));
      } else if (result?.code === 'GUEST_VOICE_LIMIT') {
        markGuestTrialOver();
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
        void flush();
      } else {
        timer.current = resumeTrialTimer(timer.current, now);
      }
    };

    const tick = window.setInterval(publish, TICK_MS);
    const beat = window.setInterval(() => void flush(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearInterval(tick);
      window.clearInterval(beat);
      document.removeEventListener('visibilitychange', onVisibility);
      void flush();
      timer.current = null;
    };
  }, [voiceMode, isGuest]);
};

export default useGuestVoiceTrial;
