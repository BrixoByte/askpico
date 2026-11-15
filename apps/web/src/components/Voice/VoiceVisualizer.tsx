import React, { useEffect, useRef, useState } from 'react';
import useStore from '@store/store';
import useVoiceStore from '@store/voice-store';
import { selectOrCreateChat } from '@hooks/useAddChat';
import { gateSignedIn } from '@utils/authGate';
import { isSignedInSession } from '@api/supabase';
import { currentLevel, currentMicStream, stopMicLevel } from '@voice/audioLevel';
import { isNativeMobileApp } from '@utils/device';
import { hasCapability, onCapabilityResult, requestAccess } from '@utils/nativeAgent';
import { PicoLogger } from '@utils/logger';
import { queryMicPermission, type MicAccess } from '@voice/micPermission';
import MicPermissionModal from './MicPermissionModal';
import MicOnboardingModal from './MicOnboardingModal';

const BAR_COUNT = 15;

// Voice mode must start from a user tap. Set to true to restore the old auto-start on launch.
const AUTO_START_VOICE_ON_LAUNCH = false;

// The probe only verifies permission, so effects are relaxed for WebView audio-driver compatibility.
const PROBE_CONSTRAINTS = {
  audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
};

// Voice-first home: a JARVIS-style orb and audio bars. Frequency data drives
// the animation through refs, so the 60fps loop never re-renders React.
const VoiceVisualizer = () => {
  const phase = useVoiceStore((state) => state.phase);
  const interim = useVoiceStore((state) => state.interim);
  const voiceError = useVoiceStore((state) => state.error);
  const voiceMode = useVoiceStore((state) => state.voiceMode);
  const statusText = voiceError
    ? voiceError
    : !voiceMode
      ? 'Tap to talk'
      : phase === 'listening'
        ? interim || 'Listening…'
        : phase === 'thinking'
          ? 'Thinking…'
          : phase === 'speaking'
            ? 'Speaking…'
            : 'Tap to talk';
  const barRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const [micAccess, setMicAccess] = useState<MicAccess | null>(null);

  useEffect(() => {
    let frame = 0;
    let t = 0;
    const tick = () => {
      t += 0.05;
      const level = currentLevel(phaseRef.current);
      const hasAudio = level >= 0;
      const amp = hasAudio ? Math.min(1, level * 2.5) : 0;
      barRefs.current.forEach((bar, i) => {
        if (!bar) return;
        const wave = (Math.sin(t + i * 0.6) + 1) / 2;
        const height = hasAudio ? 0.15 + amp * (0.5 + wave * 0.5) : 0.12 + wave * 0.12;
        bar.style.transform = `scaleY(${height})`;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  const startVoice = () => {
    void gateSignedIn('Sign in to use voice mode.', () => {
      selectOrCreateChat();
      const state = useStore.getState();
      const chatId = state.chats?.[state.currentChatIndex]?.id ?? null;
      useVoiceStore.getState().setVoiceThreadId(chatId);
      useVoiceStore.getState().setVoiceMode(true);
    });
  };

  useEffect(() => {
    let active = true;
    const autoStart = async () => {
      if (!(await isSignedInSession())) return;
      // Native app: the Android permission is the source of truth. The WebView often lacks
      // navigator.permissions, which made the query return 'unknown' and show the modal on launch.
      const access = isNativeMobileApp() && hasCapability('microphone') ? 'granted' : await queryMicPermission();
      PicoLogger.info('Permissions', 'Mount permission check', access);
      if (!active || useVoiceStore.getState().voiceMode) return;
      if (access === 'granted') {
        // Voice never starts on launch; the user starts it with a tap (see AUTO_START_VOICE_ON_LAUNCH).
        if (AUTO_START_VOICE_ON_LAUNCH) startVoice();
      } else if (access === 'prompt' || access === 'denied') setMicAccess(access);
      // 'unknown': no reliable state, so stay silent. The modal appears only when the user taps the mic.
    };
    void autoStart();
    return () => {
      active = false;
    };
  }, []);

  // Native permission answer after "Allow": a permanent denial shows the blocked screen with Open Settings.
  useEffect(() => {
    if (!isNativeMobileApp()) return;
    return onCapabilityResult((feature, granted, permanentlyDenied) => {
      if (feature !== 'microphone' || granted) return;
      PicoLogger.info('Permissions', 'Native microphone denied', { permanentlyDenied });
      setMicAccess(permanentlyDenied ? 'denied' : 'prompt');
    });
  }, []);

  // Permission granted while the modal is open (OS prompt or system settings):
  // run the live request, which dismisses the modal and starts voice mode.
  useEffect(() => {
    let active = true;
    let status: PermissionStatus | null = null;
    const onChange = () => {
      PicoLogger.info('Permissions', 'Permission state changed', status?.state);
      if (status?.state === 'granted' && !useVoiceStore.getState().voiceMode) void handleCheckMicAgain();
    };
    navigator.permissions
      ?.query({ name: 'microphone' } as unknown as PermissionDescriptor)
      .then((s) => {
        if (!active) return;
        status = s;
        s.onchange = onChange;
      })
      .catch(() => {
        // Permissions API unsupported in this WebView; the mount check and Try Again still apply.
      });
    return () => {
      active = false;
      if (status) status.onchange = null;
    };
  }, []);

  // Stops a lingering mic-level stream (never during a live voice session) and
  // gives the audio driver a short cool-down before the next request.
  const releaseLingeringMic = async () => {
    const lingering = currentMicStream();
    if (useVoiceStore.getState().voiceMode || !lingering) return;
    lingering.getTracks().forEach((track) => {
      track.stop();
      PicoLogger.info('MediaStream', `Forcibly stopped track: ${track.kind}`);
    });
    stopMicLevel();
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

  // NotReadableError means the hardware is still held: release ours, wait, retry once.
  const probeMic = async (): Promise<MediaStream> => {
    await releaseLingeringMic();
    try {
      return await navigator.mediaDevices.getUserMedia(PROBE_CONSTRAINTS);
    } catch (error) {
      if ((error as Error).name !== 'NotReadableError') throw error;
      PicoLogger.error('MediaStream', 'Hardware audio lock detected (NotReadableError), retrying once', error);
      await releaseLingeringMic();
      await new Promise((resolve) => setTimeout(resolve, 600));
      return navigator.mediaDevices.getUserMedia(PROBE_CONSTRAINTS);
    }
  };

  const handleCheckMicAgain = async () => {
    if (isNativeMobileApp()) {
      if (!hasCapability('microphone')) return setMicAccess('denied');
      setMicAccess(null);
      startVoice();
      return;
    }
    try {
      PicoLogger.info('MediaStream', 'Calling navigator.mediaDevices.getUserMedia');
      const stream = await probeMic();
      PicoLogger.info('MediaStream', 'getUserMedia SUCCESS, tracks acquired', stream.getTracks().length);
      stream.getTracks().forEach((track) => track.stop());
      PicoLogger.info('ModalState', 'Dismissing mic modal and starting voice mode');
      setMicAccess(null);
      startVoice();
    } catch (error) {
      const name = (error as Error).name;
      PicoLogger.error('MediaStream', `getUserMedia FAILED: ${name} - ${(error as Error).message}`, error);
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        PicoLogger.info('ModalState', 'Switching to blocked screen');
        setMicAccess('denied');
      } else if (name === 'NotReadableError' || name === 'AbortError') {
        // Not a denial (that is NotAllowedError): permission is granted but the hardware was busy.
        PicoLogger.info('ModalState', `${name} but OS permission is allowed, dismissing modal and starting voice mode`);
        setMicAccess(null);
        startVoice();
      } else {
        PicoLogger.info('ModalState', 'Transient error, showing allow prompt');
        setMicAccess('prompt');
      }
    }
  };

  useEffect(() => {
    if (micAccess === null || !isNativeMobileApp()) return;
    const timer = setInterval(() => {
      if (hasCapability('microphone')) void handleCheckMicAgain();
    }, 700);
    return () => clearInterval(timer);
  }, [micAccess]);

  // Returning from system settings: re-run the live request once the native
  // microphone permission is granted. hasCapability never prompts, so this
  // cannot raise a permission dialog while the permission is still denied.
  useEffect(() => {
    if (micAccess !== 'denied' || !isNativeMobileApp()) return;
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      PicoLogger.info('Lifecycle', 'App returned to foreground, checking native microphone capability');
      if (hasCapability('microphone')) void handleCheckMicAgain();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [micAccess]);

  return (
    <div className='fade-in flex w-full flex-col items-center gap-6 px-6 py-8'>
      <button
        type='button'
        onClick={startVoice}
        aria-label='Start voice mode'
        className='flex h-16 items-center gap-1.5 rounded-xl'
      >
        {Array.from({ length: BAR_COUNT }, (_, i) => (
          <span
            key={i}
            ref={(el) => {
              barRefs.current[i] = el;
            }}
            className='h-16 w-1 origin-center rounded-full bg-gradient-to-t from-[#9EFF00] to-cyan-300 shadow-[0_0_8px_rgba(158,255,0,0.6)]'
            style={{ transform: 'scaleY(0.12)' }}
          />
        ))}
      </button>

      <div role='status' aria-live='polite' className='flex min-h-[3rem] flex-col items-center gap-2 text-center text-sm text-zinc-300'>
        <span className='max-w-[18rem] break-words'>{statusText}</span>
        {voiceError && (
          <button
            type='button'
            onClick={startVoice}
            className='rounded-full border border-zinc-700 px-4 py-1 text-xs text-[#9EFF00] transition-colors hover:bg-zinc-800'
          >
            Retry
          </button>
        )}
      </div>

      {micAccess === 'denied' && (
        <MicOnboardingModal
          onCheckAgain={() => {
            PicoLogger.action('MicModal', "User clicked 'Try Again'");
            void handleCheckMicAgain();
          }}
        />
      )}
      {micAccess !== null && micAccess !== 'denied' && (
        <MicPermissionModal
          onAllow={() => {
            PicoLogger.action('MicModal', "User clicked 'Allow microphone'");
            if (isNativeMobileApp()) requestAccess('microphone');
            else void handleCheckMicAgain();
          }}
          onDismiss={() => {
            PicoLogger.action('MicModal', "User clicked 'Use text instead'");
            useVoiceStore.getState().exitVoiceHome();
          }}
        />
      )}
    </div>
  );
};

export default VoiceVisualizer;
