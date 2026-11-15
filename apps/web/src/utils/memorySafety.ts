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

export const containsSecret = (text: string): boolean =>
  SECRET_PATTERNS.some((pattern) => pattern.test(text));

export const validateMemoryText = (text: string): string | null => {
  const trimmed = text.trim();
  if (trimmed === '') return 'Memory cannot be empty.';
  if (trimmed.length > MEMORY_ITEM_MAX_LENGTH)
    return `Memory must be at most ${MEMORY_ITEM_MAX_LENGTH} characters.`;
  if (containsSecret(trimmed))
    return 'Do not save passwords, keys, tokens, or card numbers. Use the Pico vault instead.';
  return null;
};
