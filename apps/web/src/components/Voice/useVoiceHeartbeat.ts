import { useEffect } from 'react';
import { sendVoiceHeartbeat } from '@api/api';
import useGuestVoiceStore from '@store/guest-voice-store';
import useVoiceStore from '@store/voice-store';
import { createSignedInVoiceHeartbeat } from '@voice/voiceHeartbeat';

// Signed-in voice billing. Guests are handled by useGuestVoiceTrial instead —
// isGuest === false means the guest check has resolved to a real account, and
// the per-beat canSend re-check covers the user flipping mid-session, so the
// two senders can never run for the same user at once.
const useVoiceHeartbeat = () => {
  const voiceMode = useVoiceStore((state) => state.voiceMode);
  const isGuest = useGuestVoiceStore((state) => state.isGuest);

  useEffect(() => {
    if (!voiceMode || isGuest !== false) return;
    const heartbeat = createSignedInVoiceHeartbeat({
      send: (reason) => sendVoiceHeartbeat(reason).catch(() => null),
      isHidden: () => document.visibilityState === 'hidden',
      canSend: () => useGuestVoiceStore.getState().isGuest !== false,
      listenVisibility: (handler) => {
        document.addEventListener('visibilitychange', handler);
        return () => document.removeEventListener('visibilitychange', handler);
      },
    });
    heartbeat.start();
    return () => heartbeat.stop();
  }, [voiceMode, isGuest]);
};

export default useVoiceHeartbeat;
