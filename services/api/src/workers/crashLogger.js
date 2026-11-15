// Crash/error silencer: API-side failures land in system_error_logs so the
// admin panel's error view has real data. Never throws — logging must not
// crash the process it is logging.
import { supabase } from '../supabase.js';
import { logger } from '../logger.js';

export const logSystemError = (source, err, context = {}) => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack ?? null : null;
  supabase
    .from('system_error_logs')
    .insert({ source, message: message.slice(0, 4000), stack, context })
    .then(({ error }) => {
      if (error) logger.warn(`error log insert failed: ${error.message}`);
    })
    .catch(() => undefined);
};

// Captures process-level failures once; route handlers can call
// logSystemError directly for per-request context.
export const installCrashHandlers = () => {
  process.on('unhandledRejection', (reason) => {
    logSystemError('api_process', reason instanceof Error ? reason : new Error(String(reason)));
  });
  process.on('uncaughtException', (err) => {
    logSystemError('api_process', err);
  });
};
