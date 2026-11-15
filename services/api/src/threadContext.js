export const FOCUS_MAX_LENGTH = 6000;
const FOCUS_ITEM_MAX_LENGTH = 200;
const FOCUS_LIST_MAX_ITEMS = 12;
export const THREAD_RECENT_LIMIT = 6;
export const THREAD_MESSAGE_MAX_LENGTH = 500;

export const sanitizeThreadMessages = (value, limit = THREAD_RECENT_LIMIT) => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, THREAD_MESSAGE_MAX_LENGTH) }))
    .filter((m) => m.content !== '')
    .slice(-limit);
};

export const sanitizeFocus = (value) =>
  typeof value === 'string' ? value.trim().slice(0, FOCUS_MAX_LENGTH) : '';

const cleanText = (value) => (typeof value === 'string' ? value.trim().slice(0, FOCUS_ITEM_MAX_LENGTH) : '');
const cleanList = (value) =>
  Array.isArray(value) ? value.map(cleanText).filter(Boolean).slice(0, FOCUS_LIST_MAX_ITEMS) : [];

export const normalizeFocusFacts = (value) => {
  if (!value || typeof value !== 'object') return '';
  const facts = {
    current_goal: cleanText(value.current_goal),
    product_focus: cleanText(value.product_focus),
    pricing_tiers: cleanList(value.pricing_tiers),
    key_decisions: cleanList(value.key_decisions),
  };
  const isEmpty =
    !facts.current_goal && !facts.product_focus && facts.pricing_tiers.length === 0 && facts.key_decisions.length === 0;
  return isEmpty ? '' : JSON.stringify(facts);
};

export const parseFocusReply = (text) => {
  const json = typeof text === 'string' ? text.match(/\{[\s\S]*\}/)?.[0] : null;
  if (!json) return '';
  try {
    return normalizeFocusFacts(JSON.parse(json));
  } catch {
    return '';
  }
};

export const renderFocus = (focus) => {
  const text = sanitizeFocus(focus);
  let facts;
  try {
    facts = JSON.parse(text);
  } catch {
    return text;
  }
  if (!facts || typeof facts !== 'object') return text;
  const lines = [];
  if (facts.current_goal) lines.push(`- current_goal: ${facts.current_goal}`);
  if (facts.product_focus) lines.push(`- product_focus: ${facts.product_focus}`);
  for (const key of ['pricing_tiers', 'key_decisions']) {
    if (Array.isArray(facts[key]) && facts[key].length > 0) {
      lines.push(`- ${key}:`, ...facts[key].map((item) => `  - ${item}`));
    }
  }
  return lines.join('\n');
};

const numbersIn = (text) =>
  new Set((text.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((n) => n.replace(/,/g, '')));

const isGrounded = (text, userNumbers) =>
  typeof text === 'string' && [...numbersIn(text)].every((n) => userNumbers.has(n));

const factsFrom = (text) => {
  try {
    return JSON.parse(parseFocusReply(text) || '{}');
  } catch {
    return {};
  }
};

export const mergeGroundedFacts = (previous, reply, userText) => {
  const userNumbers = numbersIn(typeof userText === 'string' ? userText : '');
  const proposed = factsFrom(reply);
  const prior = factsFrom(previous);
  const grounded = (list = []) => list.filter((item) => isGrounded(item, userNumbers));
  const rejected = [...(proposed.pricing_tiers ?? []), ...(proposed.key_decisions ?? [])].filter(
    (item) => !isGrounded(item, userNumbers)
  ).length;
  const facts = normalizeFocusFacts({
    current_goal: isGrounded(proposed.current_goal, userNumbers) ? proposed.current_goal : prior.current_goal,
    product_focus: isGrounded(proposed.product_focus, userNumbers) ? proposed.product_focus : prior.product_focus,
    pricing_tiers: [...new Set([...(prior.pricing_tiers ?? []), ...grounded(proposed.pricing_tiers)])],
    key_decisions: [...new Set([...(prior.key_decisions ?? []), ...grounded(proposed.key_decisions)])],
  });
  return { facts: facts || sanitizeFocus(previous), rejected };
};

export const buildThreadBlock = (focus, recent) => {
  const anchor = renderFocus(focus);
  const lines = sanitizeThreadMessages(recent).map((m) => `${m.role}: ${m.content}`);
  if (!anchor && lines.length === 0) return '';
  const parts = [];
  if (anchor) parts.push(`[THREAD FACTS - hard facts from earlier in this thread; treat as authoritative and do not contradict]\n${anchor}`);
  if (lines.length > 0) parts.push(`[RECENT MESSAGES]\n${lines.join('\n')}`);
  return parts.join('\n\n');
};

export const withThread = (systemContent, focus, recent) => {
  const block = buildThreadBlock(focus, recent);
  if (!block) return systemContent;
  return `${systemContent}\n\nThe conversation thread below is the ongoing context. Stay consistent with its goal, and when the user refers to earlier topics, use this context instead of asking again.\n\n${block}`;
};
