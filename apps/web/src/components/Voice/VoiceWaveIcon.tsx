import React from 'react';

const BARS: { height: string; delay: string }[] = [
  { height: '60%', delay: '0ms' },
  { height: '100%', delay: '200ms' },
  { height: '40%', delay: '400ms' },
  { height: '80%', delay: '100ms' },
  { height: '50%', delay: '300ms' },
];

// Animated audio-wave glyph for the voice-to-voice trigger. Dark bars stay
// visible on the lime button in both themes.
const VoiceWaveIcon = () => (
  <div className='flex h-4 items-center justify-center gap-0.5' aria-hidden='true'>
    {BARS.map((bar, index) => (
      <span
        key={index}
        className='w-0.5 origin-center rounded-full bg-black/80 animate-voice-bar'
        style={{ height: bar.height, animationDelay: bar.delay }}
      />
    ))}
  </div>
);

export default VoiceWaveIcon;
