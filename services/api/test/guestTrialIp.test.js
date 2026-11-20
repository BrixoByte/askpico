import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashSignal } from '../src/guestTrialIp.js';

test('hashSignal is deterministic, keyed, and never returns the raw value', () => {
  const h1 = hashSignal('ip:203.0.113.7');
  assert.equal(h1, hashSignal('ip:203.0.113.7'));
  assert.notEqual(h1, hashSignal('ip:203.0.113.8'));
  assert.notEqual(h1, 'ip:203.0.113.7');
  assert.match(h1, /^[0-9a-f]{64}$/);
});
