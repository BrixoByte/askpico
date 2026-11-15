export const CHAT_MAX_MESSAGES = 200;
export const CHAT_MAX_MESSAGE_CHARS = 100_000;
export const FILE_NAME_MAX_LENGTH = 255;

const CHAT_ROLES = new Set(['system', 'user', 'assistant']);

export const validateChatMessages = (messages) => {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages array is required';
  if (messages.length > CHAT_MAX_MESSAGES) {
    return `messages can contain at most ${CHAT_MAX_MESSAGES} items`;
  }
  for (const message of messages) {
    if (!message || typeof message !== 'object' || !CHAT_ROLES.has(message.role)) {
      return 'each message needs a valid role';
    }
    if (typeof message.content !== 'string') return 'each message content must be a string';
    if (message.content.length > CHAT_MAX_MESSAGE_CHARS) {
      return `message content exceeds ${CHAT_MAX_MESSAGE_CHARS} characters`;
    }
  }
  return null;
};

export const isSafeFileName = (name) =>
  typeof name === 'string' &&
  name.trim() !== '' &&
  name.length <= FILE_NAME_MAX_LENGTH &&
  !/[\\/\u0000-\u001f]/.test(name);

export const DEV_CORS_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://10.0.2.2:5173',
  'http://chat.localhost:5173',
  'http://auth.localhost:5173',
  'http://chama.localhost:5174',
];

export const resolveCorsOrigins = ({ corsOrigin, nodeEnv }) => {
  const explicit = (corsOrigin ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;
  return nodeEnv === 'production' ? [] : DEV_CORS_ORIGINS;
};

// Fixed-window counter. In-memory: per process only. Use a shared store
// (e.g. Redis or a Supabase table) before running more than one instance.
export const createLimiter = ({ max, windowMs = 60_000 }) => {
  const hits = new Map();

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (now > entry.reset) hits.delete(key);
    }
  }, windowMs);
  sweep.unref();

  return {
    take(key) {
      const now = Date.now();
      let entry = hits.get(key);
      if (!entry || now > entry.reset) {
        entry = { count: 0, reset: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        allowed: entry.count <= max,
        retryAfter: Math.ceil((entry.reset - now) / 1000),
      };
    },
  };
};

export const LIMITED_MESSAGE = 'Too many requests. Please wait a minute and try again.';

// Sends 429 and returns true when the key is over its limit.
export const rejectIfLimited = (limiter, key, res) => {
  const { allowed, retryAfter } = limiter.take(key);
  if (allowed) return false;
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({ error: LIMITED_MESSAGE });
  return true;
};

// Pre-auth middleware: keyed by client IP.
export const rateLimit = ({ max, windowMs = 60_000 }) => {
  const limiter = createLimiter({ max, windowMs });
  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    if (rejectIfLimited(limiter, `ip:${ip}`, res)) return;
    next();
  };
};
