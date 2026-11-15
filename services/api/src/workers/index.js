// Admin background workers. Started from server.js; each task is isolated so
// one failure never stops the others. Intervals are unref'd so they cannot
// keep the process alive during shutdown.
import { logger } from '../logger.js';
import { runAggregator } from './aggregator.js';
import { installCrashHandlers } from './crashLogger.js';
import { sweepAbusiveUsers } from './intentClassifier.js';
import { runWatchdog } from './watchdog.js';

const WATCHDOG_MS = 5 * 60 * 1000; // every 5 min: budget + error spike check
const CLASSIFIER_SWEEP_MS = 15 * 60 * 1000; // every 15 min: flag abusive users
const AGGREGATOR_MS = 60 * 60 * 1000; // hourly: rewrite today's summary

const schedule = (name, fn, ms) => {
  const tick = () =>
    Promise.resolve()
      .then(fn)
      .catch((err) => logger.warn(`${name} failed: ${err.message}`));
  void tick(); // run once at boot, then on the interval
  return setInterval(tick, ms).unref();
};

export const startAdminWorkers = () => {
  if (process.env.ADMIN_WORKERS === 'off') return;
  installCrashHandlers();
  schedule('watchdog', runWatchdog, WATCHDOG_MS);
  schedule('classifier-sweep', sweepAbusiveUsers, CLASSIFIER_SWEEP_MS);
  schedule('aggregator', runAggregator, AGGREGATOR_MS);
  logger.info('admin workers started (watchdog, classifier sweep, aggregator)');
};
