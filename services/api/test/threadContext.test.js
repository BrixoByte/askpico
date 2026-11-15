import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildThreadBlock,
  FOCUS_MAX_LENGTH,
  sanitizeFocus,
  sanitizeThreadMessages,
  THREAD_MESSAGE_MAX_LENGTH,
  THREAD_RECENT_LIMIT,
  withThread,
} from '../src/threadContext.js';

test('sanitizeThreadMessages keeps only the last recent messages with valid roles', () => {
  const input = [
    { role: 'system', content: 'ignored' },
    ...Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` })),
    { role: 'user', content: '   ' },
  ];
  const out = sanitizeThreadMessages(input);
  assert.equal(out.length, THREAD_RECENT_LIMIT);
  assert.equal(out.at(-1).content, 'm9');
  assert.ok(out.every((m) => m.role === 'user' || m.role === 'assistant'));
});

test('sanitizeThreadMessages truncates long content and honours a custom limit', () => {
  const long = 'x'.repeat(THREAD_MESSAGE_MAX_LENGTH + 50);
  const [item] = sanitizeThreadMessages([{ role: 'user', content: long }]);
  assert.equal(item.content.length, THREAD_MESSAGE_MAX_LENGTH);
  assert.equal(sanitizeThreadMessages(Array.from({ length: 8 }, (_, i) => ({ role: 'user', content: `q${i}` })), 3).length, 3);
});

test('sanitizeFocus trims and caps the anchor and rejects non-strings', () => {
  assert.equal(sanitizeFocus(42), '');
  assert.equal(sanitizeFocus('  goal  '), 'goal');
  assert.equal(sanitizeFocus('g'.repeat(FOCUS_MAX_LENGTH + 10)).length, FOCUS_MAX_LENGTH);
});

test('buildThreadBlock includes focus and recent messages under labeled headers', () => {
  const block = buildThreadBlock('User Goal: sushi PDF book', [{ role: 'user', content: 'price?' }]);
  assert.match(block, /\[THREAD FACTS[^\n]*\]\nUser Goal: sushi PDF book/);
  assert.match(block, /\[RECENT MESSAGES\]\nuser: price\?/);
});

test('buildThreadBlock returns empty string when there is no context', () => {
  assert.equal(buildThreadBlock('', []), '');
  assert.equal(withThread('base', '', []), 'base');
});

test('withThread appends thread context after the base system prompt', () => {
  const out = withThread('base', 'Goal: launch', []);
  assert.ok(out.startsWith('base\n\n'));
  assert.match(out, /\[THREAD FACTS/);
});
