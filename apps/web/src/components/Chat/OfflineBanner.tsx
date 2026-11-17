import React, { useSyncExternalStore } from 'react';

const FORCE_OFFLINE_EVENT = 'pico:force-offline';

// Debug/test hook: open the app with ?pico-offline in the URL (or call setForcedOffline
// from the console) to simulate a lost connection without airplane mode or clearing the
// HTTP cache. It is UI-only: it never signs the user out or touches any request.
let forcedOffline =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('pico-offline');

export const setForcedOffline = (value: boolean) => {
  forcedOffline = value;
  window.dispatchEvent(new Event(FORCE_OFFLINE_EVENT));
};

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  window.addEventListener(FORCE_OFFLINE_EVENT, onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
    window.removeEventListener(FORCE_OFFLINE_EVENT, onChange);
  };
};

// Only a notice. The session is kept, and nothing signs the user out because of a lost connection.
const OfflineBanner = () => {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine && !forcedOffline, () => true);
  if (online) return null;
  return (
    <div
      role='status'
      className='fixed inset-x-0 top-0 z-[60] bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900 dark:bg-amber-900/80 dark:text-amber-100'
    >
      You are offline. Reconnect to keep chatting. Your account stays signed in.
    </div>
  );
};

export default OfflineBanner;
