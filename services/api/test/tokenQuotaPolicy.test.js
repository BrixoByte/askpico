import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dailyTokenLimit, isDailyTokenCapReached } from '../src/tokenQuotaPolicy.js';

test('free plan gets a 10,000 token daily cap', () => {
  assert.equal(dailyTokenLimit('free'), 10000);
});

test('paid plans have no daily token cap', () => {
  assert.equal(dailyTokenLimit('weekly'), null);
  assert.equal(dailyTokenLimit('monthly'), null);
});

test('unknown plan falls back to the free cap', () => {
  assert.equal(dailyTokenLimit('mystery'), 10000);
});

test('free user is blocked exactly at the cap', () => {
  assert.equal(isDailyTokenCapReached('free', 9999), false);
  assert.equal(isDailyTokenCapReached('free', 10000), true);
  assert.equal(isDailyTokenCapReached('free', 12000), true);
});

test('paid user is never blocked by the token cap', () => {
  assert.equal(isDailyTokenCapReached('monthly', 10_000_000), false);
});
