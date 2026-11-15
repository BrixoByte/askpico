export const MEMORY_MAX_ITEMS = 30;
export const MEMORY_ITEM_MAX_LENGTH = 300;

const SECRET_PATTERNS = [
  /\b(password|passwd|pwd|passcode|secret|api[_ -]?key|access[_ -]?token|private[_ -]?key)\b/i,
  /\bsk-[A-Za-z0-9_-]{16,}/,
  /\bAIza[0-9A-Za-z_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /\b(?:\d[ -]?){13,19}\b/,
];

export const containsSecret = (text) => SECRET_PATTERNS.some((pattern) => pattern.test(text));

export const sanitizeMemories = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, MEMORY_ITEM_MAX_LENGTH))
    .filter((item) => item !== '' && !containsSecret(item))
    .slice(0, MEMORY_MAX_ITEMS);
};

export const validateMemoryItems = (value) => {
  if (!Array.isArray(value)) return 'items must be an array';
  if (value.length > MEMORY_MAX_ITEMS) return `at most ${MEMORY_MAX_ITEMS} memories allowed`;
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') return 'each memory must be non-empty text';
    if (item.trim().length > MEMORY_ITEM_MAX_LENGTH) return `each memory must be at most ${MEMORY_ITEM_MAX_LENGTH} characters`;
    if (containsSecret(item)) return 'memory must not contain passwords, keys, tokens, or card numbers';
  }
  return null;
};

const STYLE_CONSTRAINT_PATTERN =
  /\b(keep|reply|replies|answer|answers|respond|responses?)\b.*\b(short|shorter|brief|briefly|concise)\b|\bmax(imum)?\s+\d+\s*(lines?|words?|sentences?|bullets?)\b/i;

export const isStyleConstraint = (item) => STYLE_CONSTRAINT_PATTERN.test(item);

export const buildMemoryBlock = (memories) => {
  const items = sanitizeMemories(memories);
  if (items.length === 0) return '';
  const constraints = items.filter(isStyleConstraint);
  const facts = items.filter((item) => !isStyleConstraint(item));
  const parts = [];
  // Hard constraints lead the block: they are operational requirements, not
  // advisory facts, and override persona defaults and other instructions.
  if (constraints.length > 0) {
    const lines = constraints.map((item) => `- ${item}`).join('\n');
    parts.push(`[HARD CONSTRAINT — NON-NEGOTIABLE]: these are direct operational requirements for every reply. They override the persona's default length, detail, and formatting:\n${lines}`);
  }
  if (facts.length > 0) {
    const lines = facts.map((item) => `- ${item}`).join('\n');
    parts.push(`What you know about the user (use it to personalize answers; do not recite it unprompted):\n${lines}`);
  }
  return parts.join('\n\n');
};

export const withMemory = (systemContent, memories) => {
  const block = buildMemoryBlock(memories);
  return block ? `${systemContent}\n\n${block}` : systemContent;
};
