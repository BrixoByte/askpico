import { appendFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'node:util';

const isProduction = process.env.NODE_ENV === 'production';
const logFile = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'debug-web.log');

export const logger = {
  debug: (...args) => {
    if (!isProduction) console.log(...args);
  },
  info: (...args) => {
    if (!isProduction) console.log(...args);
  },
  warn: (...args) => console.warn(...args),
  error: (...args) => console.error(...args),
};

if (!isProduction) {
  writeFileSync(logFile, '');
  for (const level of ['log', 'info', 'warn', 'error']) {
    const original = console[level].bind(console);
    console[level] = (...args) => {
      original(...args);
      appendFileSync(logFile, `[${new Date().toISOString()}] ${format(...args)}\n`);
    };
  }
}
