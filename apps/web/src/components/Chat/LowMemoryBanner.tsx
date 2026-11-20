import React, { useSyncExternalStore } from 'react';
import { isLowMemoryMode, subscribeLowMemory } from '@utils/nativeAgent';

// Shown after the Android shell reports a memory trim (window.PicoMemory).
// Previews and the shield overlay are paused; chat keeps working.
const LowMemoryBanner = () => {
  const low = useSyncExternalStore(subscribeLowMemory, isLowMemoryMode, () => false);
  if (!low) return null;
  return (
    <div
      role='status'
      className='fixed inset-x-0 top-0 z-[60] bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/80 dark:text-amber-100'
    >
      This device is low on memory — previews and the app shield are paused so
      chat keeps working.
    </div>
  );
};

export default LowMemoryBanner;
