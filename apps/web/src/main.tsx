import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import AuthPage from '@components/Auth/AuthPage';
import { initSharedTheme } from '@utils/sharedTheme';
import { PicoLogger } from '@utils/logger';
import './main.css';
await import('katex/dist/katex.min.css');

import './i18n';

// One deployment serves both subdomains (beta plan section 8): auth.* shows
// the sign-in page, chat.* and everything else shows the app. The /auth path
// gives local dev the same page without DNS.
const isAuthRoute =
  window.location.hostname.startsWith('auth.') || window.location.pathname === '/auth';

initSharedTheme();

// Browser extensions inject scripts into the page; their failures surface in the
// global handlers and would pollute the debug log. Skip anything from an
// extension origin since we cannot act on it.
const isExtensionError = (text: string) =>
  text.includes('chrome-extension://') || text.includes('moz-extension://');

window.addEventListener('error', (event) => {
  if (isExtensionError(`${event.filename} ${event.error?.stack ?? ''}`)) return;
  PicoLogger.error('GlobalError', `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = String(event.reason?.stack ?? event.reason);
  if (isExtensionError(reason)) return;
  PicoLogger.error('UnhandledRejection', String(event.reason), event.reason);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {isAuthRoute ? <AuthPage /> : <App />}
  </React.StrictMode>
);
