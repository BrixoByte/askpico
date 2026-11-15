import { backendUrl } from '@api/api';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isDev = import.meta.env.DEV;

const stringify = (value: unknown): string => {
  if (value instanceof Error) return value.stack ?? value.message;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
};

const relayToTerminal = (level: LogLevel, args: unknown[]) => {
  fetch(`${backendUrl}/api/client-log`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ level, message: args.map(stringify).join(' ') }),
    keepalive: true,
  }).catch(() => undefined);
};

const createLevel = (level: LogLevel) => (...args: unknown[]) => {
  if (isDev) relayToTerminal(level, args);
};

export const logger = {
  debug: createLevel('debug'),
  info: createLevel('info'),
  warn: createLevel('warn'),
  error: createLevel('error'),
};

type NativeLogBridge = { logMessage?: (msg: string) => void; logError?: (msg: string) => void };

const nativeLog = (method: keyof NativeLogBridge, msg: string) => {
  try {
    (window as unknown as { PicoBridge?: NativeLogBridge }).PicoBridge?.[method]?.(msg);
  } catch {
    // Native bridge unavailable (desktop browser).
  }
};

export const PicoLogger = {
  info: (tag: string, message: string, data?: unknown) => {
    const msg = `🟢 [PICO-INFO][${tag}]: ${message}`;
    console.log(msg, data !== undefined ? data : '');
    nativeLog('logMessage', msg);
    logger.info(msg, ...(data !== undefined ? [data] : []));
  },
  error: (tag: string, message: string, error?: unknown) => {
    const msg = `🔴 [PICO-ERROR][${tag}]: ${message}`;
    console.error(msg, error !== undefined ? error : '');
    nativeLog('logError', msg);
    logger.error(msg, ...(error !== undefined ? [error] : []));
  },
  action: (tag: string, actionName: string, state?: unknown) => {
    console.log(
      `⚡ [PICO-ACTION][${tag}] User Action: %c${actionName}`,
      'background: #9EFF00; color: #000; font-weight: bold; padding: 2px 4px; border-radius: 3px;',
      state !== undefined ? state : ''
    );
    const msg = `⚡ [PICO-ACTION][${tag}] User Action: ${actionName}`;
    nativeLog('logMessage', msg);
    logger.info(msg, ...(state !== undefined ? [state] : []));
  },
};
