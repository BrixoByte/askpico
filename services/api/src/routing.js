import { routeModelDefaults, routingGlobalCaps, routingLimits, llmProvider } from './config.js';

const INT_MAX = 2147483647;
const MODE_LEVEL = { quick: 0, smart: 1, deep_fast: 2, deep_pro: 3 };
const COMPLEX_KEYWORDS = /multi-file|full app|complete|analy[sz]|summar|document|report|build|website|project/i;

export const estimateComplexity = (message = '', attachmentCount = 0) => {
  const length = message.length;
  const lengthPoints = length >= 1500 ? 2 : length >= 300 ? 1 : 0;
  const attachmentPoints = attachmentCount > 0 ? 1 : 0;
  const keywordPoints = COMPLEX_KEYWORDS.test(message) ? 1 : 0;
  return lengthPoints + attachmentPoints + keywordPoints;
};

const autoMode = (score) => {
  if (score >= 4) return 'deep_pro';
  if (score >= 3) return 'deep_fast';
  if (score >= 1) return 'smart';
  return 'quick';
};

export const chooseMode = ({ requestType, requested, message = '', attachmentCount = 0 } = {}) => {
  const score = estimateComplexity(message, attachmentCount);
  let mode;
  if (requested === 'quick' || requested === 'smart') {
    mode = requested;
  } else if (requested === 'deep') {
    mode = score >= 3 ? 'deep_pro' : 'deep_fast';
  } else {
    mode = autoMode(score);
  }
  if (requestType === 'voice' && MODE_LEVEL[mode] > MODE_LEVEL.smart) return 'smart';
  return mode;
};

export const capModeForPlan = (mode, plan) => {
  const planKey = routingLimits[plan] ? plan : 'free';
  if (planKey === 'free' && mode === 'deep_pro') return 'deep_fast';
  return mode;
};

const DOWNGRADE = { deep_pro: 'deep_fast', deep_fast: 'smart', smart: 'quick', quick: null };
export const downgradeFrom = (mode) => DOWNGRADE[mode] ?? null;

const PUBLIC_MODE = { quick: 'quick', smart: 'smart', deep_fast: 'deep', deep_pro: 'deep' };
export const publicMode = (mode) => PUBLIC_MODE[mode] ?? 'quick';

export const modelsForMode = (mode) => {
  const override = process.env[`ROUTE_MODELS_${mode.toUpperCase()}`];
  const list = override ?? routeModelDefaults[llmProvider]?.[mode]?.join(',') ?? '';
  return list
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
};

const planLimitFor = (plan, mode) => {
  const planKey = routingLimits[plan] ? plan : 'free';
  return routingLimits[planKey][mode] ?? 0;
};

const toInt = (value) => (Number.isFinite(value) ? value : INT_MAX);

export const grantMode = async ({ rpc, userId, plan, startMode }) => {
  let mode = capModeForPlan(startMode, plan);
  while (mode) {
    if (mode === 'quick') return 'quick';
    const { data, error } = await rpc('consume_routing_mode', {
      p_user_id: userId,
      p_mode: mode,
      p_user_limit: toInt(planLimitFor(plan, mode)),
      p_global_cap: toInt(routingGlobalCaps[mode]),
    });
    if (error) throw new Error(error.message);
    if (data === true) return mode;
    mode = downgradeFrom(mode);
  }
  return 'quick';
};
