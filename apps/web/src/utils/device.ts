import { useSyncExternalStore } from 'react';
import { isNativeApp } from './nativeAgent';

// True only inside the Android wrapper (WebView UA token set in MainActivity.kt,
// or the PicoBridge JS interface). Browser mobile viewports return false.
export const isNativeMobileApp = () =>
  /PicoApp\//.test(navigator.userAgent) || isNativeApp();

export const isMobileDevice = () =>
  window.innerWidth < 768 || isNativeMobileApp();

const subscribeOrientation = (query: string) => (onChange: () => void) => {
  const mq = window.matchMedia(query);
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
};

// True inside the Android wrapper while the device is in landscape. Drives the
// persistent left sidebar (desktop layout) instead of the portrait overlay drawer.
export const useLandscapeNativeApp = (): boolean => {
  const native = isNativeMobileApp();
  return useSyncExternalStore(
    subscribeOrientation('(orientation: landscape)'),
    () => native && window.matchMedia('(orientation: landscape)').matches,
    () => false
  );
};

// Landscape phones are only ~360-420 CSS px tall; compact mode shrinks chrome.
export const useCompactViewport = (): boolean =>
  useSyncExternalStore(
    subscribeOrientation('(max-height: 500px)'),
    () => window.matchMedia('(max-height: 500px)').matches,
    () => false
  );
