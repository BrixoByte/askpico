import React, { useEffect, useRef } from 'react';
import useSubmit from '@hooks/useSubmit';
import useVoiceStore from '@store/voice-store';
import { VoiceSession } from '@voice/session';

// Invisible component that owns the voice-to-voice session. Mounted once in
// App; the session starts/stops with voiceMode in the voice store.
const VoiceController = () => {
  const voiceMode = useVoiceStore((state) => state.voiceMode);
  const { handleSubmit } = useSubmit();
  const submitRef = useRef(handleSubmit);
  submitRef.current = handleSubmit;
  const sessionRef = useRef<VoiceSession | null>(null);

  useEffect(() => {
    const session = new VoiceSession({ submit: () => submitRef.current() });
    sessionRef.current = session;
    return () => {
      session.dispose();
      sessionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;
    if (voiceMode) session.start();
    else session.stop();
  }, [voiceMode]);

  return null;
};

export default VoiceController;
