import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMemoryBlock,
  containsSecret,
  MEMORY_ITEM_MAX_LENGTH,
  MEMORY_MAX_ITEMS,
  sanitizeMemories,
  validateMemoryItems,
  withMemory,
} from '../src/memory.js';

test('containsSecret flags passwords, API keys, tokens, and card numbers', () => {
  assert.equal(containsSecret('my password is hunter2'), true);
  assert.equal(containsSecret('OpenAI key sk-abcdefghijklmnop1234'), true);
  assert.equal(containsSecret('card 4111 1111 1111 1111'), true);
  assert.equal(containsSecret('Google key AIzaSyA1234567890abcdefghijk'), true);
});

test('containsSecret allows ordinary preferences', () => {
  assert.equal(containsSecret('I prefer concise answers'), false);
  assert.equal(containsSecret('Building Pico in Karachi'), false);
  assert.equal(containsSecret('Order 12345 shipped'), false);
});

test('sanitizeMemories drops secret-like items', () => {
  assert.deepEqual(sanitizeMemories(['ok fact', 'my password is x']), ['ok fact']);
});

test('validateMemoryItems accepts clean lists and rejects bad ones', () => {
  assert.equal(validateMemoryItems(['I like tea']), null);
  assert.match(validateMemoryItems('nope'), /array/);
  assert.match(validateMemoryItems(['']), /non-empty/);
  assert.match(validateMemoryItems(['x'.repeat(MEMORY_ITEM_MAX_LENGTH + 1)]), /at most/);
  assert.match(validateMemoryItems(['api_key: abc']), /must not contain/);
  assert.match(
    validateMemoryItems(Array.from({ length: MEMORY_MAX_ITEMS + 1 }, (_, i) => `f${i}`)),
    /at most/
  );
});

test('sanitizeMemories drops non-strings, blanks, and caps length and count', () => {
  const long = 'x'.repeat(MEMORY_ITEM_MAX_LENGTH + 50);
  const many = Array.from({ length: MEMORY_MAX_ITEMS + 5 }, (_, i) => `fact ${i}`);
  const result = sanitizeMemories(['  keep me  ', 42, '   ', long, ...many]);
  assert.equal(result[0], 'keep me');
  assert.equal(result[1].length, MEMORY_ITEM_MAX_LENGTH);
  assert.equal(result.length, MEMORY_MAX_ITEMS);
});

test('sanitizeMemories returns an empty list for non-array input', () => {
  assert.deepEqual(sanitizeMemories('not an array'), []);
  assert.deepEqual(sanitizeMemories(undefined), []);
});

test('buildMemoryBlock returns empty string when there are no memories', () => {
  assert.equal(buildMemoryBlock([]), '');
  assert.equal(buildMemoryBlock(undefined), '');
});

test('buildMemoryBlock lists each memory as a bullet', () => {
  const block = buildMemoryBlock(['I prefer concise answers', 'Building Pico']);
  assert.match(block, /- I prefer concise answers\n- Building Pico$/);
});

test('withMemory appends the block to the system prompt only when memories exist', () => {
  assert.equal(withMemory('SYS', []), 'SYS');
  const merged = withMemory('SYS', ['Building Pico']);
  assert.ok(merged.startsWith('SYS\n\n'));
  assert.ok(merged.endsWith('- Building Pico'));
});
