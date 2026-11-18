// Dev-only override: route reply TTS to a local laptop service (edge-tts lib or
// Kokoro-82M) instead of the API provider chain — for testing the same engine
// the server would use without deploying TTS_SERVICE_URL.
//
// Requires BOTH a dev build (import.meta.env.DEV) and the build-time flag
// VITE_DEV_LAPTOP_TTS=true. A production or release build can never enable it:
// import.meta.env.DEV is false there, so this always returns null.
// The env is injectable so tests can simulate a release build.

type LaptopTtsEnv = {
  DEV?: boolean;
  VITE_DEV_LAPTOP_TTS?: string;
  VITE_LAPTOP_TTS_URL?: string;
};

export const devLaptopTtsUrl = (env: LaptopTtsEnv = import.meta.env): string | null => {
  if (!env.DEV || env.VITE_DEV_LAPTOP_TTS !== 'true') return null;
  const base = (env.VITE_LAPTOP_TTS_URL || 'http://localhost:8787').replace(/\/+$/, '');
  return `${base}/tts`;
};
