import React from 'react';
import useVoiceStore from '@store/voice-store';

// Voice mode status strip shown above the composer: listening state with
// live interim transcript, speaking state, and voice errors.
const VoiceStatus = () => {
  const voiceMode = useVoiceStore((state) => state.voiceMode);
  const phase = useVoiceStore((state) => state.phase);
  const error = useVoiceStore((state) => state.error);

  if (!voiceMode && !error) return null;

  if (error) {
    return (
      <div className='flex items-center gap-2 border-t border-red-200 bg-red-50/80 px-4 py-2 text-xs text-red-600 dark:border-red-900/50 dark:bg-red-950/40'>
        <span className='h-2 w-2 rounded-full bg-red-500' />
        {error}
      </div>
    );
  }

  if (!voiceMode) return null;

  if (phase !== 'thinking') return null;

  const label = 'Thinking…';
  const dot = 'bg-amber-500';

  return (
    <div className='flex items-center gap-2 border-t border-surface-line bg-surface-muted/60 px-4 py-2 text-xs text-ink-soft'>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
    </div>
  );
};

export default VoiceStatus;
