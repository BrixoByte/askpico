import React, { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
};

// Only a notice. The session is kept, and nothing signs the user out because of a lost connection.
const OfflineBanner = () => {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
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
