import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  GUEST_TRIAL_IP_CAP,
  GUEST_TRIAL_REDUCED_SECONDS,
  clientIp,
  hashGuestIp,
  normalizeClientIp,
} from '../src/guestTrialIp.js';
import { resolveGuestTrialSeconds } from '../src/guestVoice.js';
import { GUEST_VOICE_LIMIT_SECONDS } from '../src/voiceQuotaPolicy.js';
import { fakeGrants } from './guestVoice.test.js';

// --- normalizeClientIp ---

test('IPv4 is used whole', () => {
  assert.equal(normalizeClientIp('203.0.113.7'), '203.0.113.7');
});

test('IPv6 is grouped by /64 so rotating the interface-id does not evade', () => {
  const a = normalizeClientIp('2001:db8:abcd:1234:1111:2222:3333:4444');
  const b = normalizeClientIp('2001:db8:abcd:1234:aaaa:bbbb:cccc:dddd');
  assert.equal(a, b);
  assert.equal(a, '2001:db8:abcd:1234::/64');
  assert.notEqual(normalizeClientIp('2001:db8:ffff:1234::1'), a);
});

test('IPv4-mapped IPv6 collapses to the IPv4 form', () => {
  assert.equal(normalizeClientIp('::ffff:203.0.113.7'), '203.0.113.7');
});

test('loopback and empty IPs normalize safely', () => {
  assert.equal(normalizeClientIp('::1'), '0:0:0:0::/64');
  assert.equal(normalizeClientIp(''), '');
  assert.equal(normalizeClientIp(undefined), '');
});

test('clientIp prefers the first X-Forwarded-For hop', () => {
  assert.equal(clientIp({ headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' }, ip: '10.0.0.2' }), '198.51.100.9');
  assert.equal(clientIp({ headers: {}, ip: '198.51.100.9' }), '198.51.100.9');
  assert.equal(clientIp({ headers: {}, socket: { remoteAddress: '198.51.100.9' } }), '198.51.100.9');
});

test('hashGuestIp is deterministic, keyed, and groups by /64', () => {
  const h1 = hashGuestIp('203.0.113.7');
  assert.equal(h1, hashGuestIp('203.0.113.7'));
  assert.notEqual(h1, hashGuestIp('203.0.113.8'));
  assert.equal(hashGuestIp('2001:db8:abcd:1::1'), hashGuestIp('2001:db8:abcd:1::2'));
  assert.notEqual(h1, '203.0.113.7'); // never the raw IP
  assert.equal(hashGuestIp(''), null);
});

// --- resolveGuestTrialSeconds: the IP grant cap ---

const newUser = (i) => `user-${i}`;

test('a fresh IP grants the full 120 s trial', async () => {
  const db = fakeGrants();
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: newUser(1), ipHash: 'ip-a' });
  assert.equal(seconds, GUEST_VOICE_LIMIT_SECONDS);
  assert.equal(db.rows.length, 1);
  assert.equal(db.rows[0].granted_seconds, 120);
});

test('a stored grant is reused on later calls (stable per user)', async () => {
  const db = fakeGrants([{ user_id: 'u-old', ip_hash: 'ip-a', granted_seconds: 30, created_at: new Date().toISOString() }]);
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: 'u-old', ipHash: 'ip-b' });
  assert.equal(seconds, 30); // stored grant wins even from a new IP
  assert.equal(db.rows.length, 1); // no new row
});

test('grants without an IP hash fall back to the full limit and write nothing', async () => {
  const db = fakeGrants();
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: newUser(2) });
  assert.equal(seconds, GUEST_VOICE_LIMIT_SECONDS);
  assert.equal(db.rows.length, 0);
});

test('the 9th new guest on one IP in 24h gets the reduced trial, not zero', async () => {
  const db = fakeGrants();
  const now = new Date().toISOString();
  for (let i = 0; i < GUEST_TRIAL_IP_CAP; i++) {
    db.rows.push({ user_id: `u-${i}`, ip_hash: 'ip-nat', granted_seconds: 120, created_at: now });
  }
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: 'u-new', ipHash: 'ip-nat' });
  assert.equal(seconds, GUEST_TRIAL_REDUCED_SECONDS);
  assert.equal(db.rows.at(-1).granted_seconds, 30);
});

test('shared NAT: a household under the cap still gets full trials', async () => {
  const db = fakeGrants();
  const results = [];
  for (let i = 0; i < 4; i++) {
    results.push(await resolveGuestTrialSeconds({ client: db.client, userId: `fam-${i}`, ipHash: 'ip-home' }));
  }
  assert.deepEqual(results, [120, 120, 120, 120]);
});

test('grants older than 24h do not count toward the cap', async () => {
  const old = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
  const db = fakeGrants(
    Array.from({ length: GUEST_TRIAL_IP_CAP + 4 }, (_, i) => ({
      user_id: `old-${i}`,
      ip_hash: 'ip-old',
      granted_seconds: 120,
      created_at: old,
    })),
  );
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: 'fresh', ipHash: 'ip-old' });
  assert.equal(seconds, GUEST_VOICE_LIMIT_SECONDS);
});

test('different IPs do not share the cap', async () => {
  const db = fakeGrants(
    Array.from({ length: GUEST_TRIAL_IP_CAP }, (_, i) => ({
      user_id: `a-${i}`,
      ip_hash: 'ip-a',
      granted_seconds: 120,
      created_at: new Date().toISOString(),
    })),
  );
  const seconds = await resolveGuestTrialSeconds({ client: db.client, userId: 'b-new', ipHash: 'ip-b' });
  assert.equal(seconds, GUEST_VOICE_LIMIT_SECONDS);
});

test('a concurrent first touch falls back to the stored grant', async () => {
  const db = fakeGrants();
  let calls = 0;
  const client = {
    from: (t) => {
      const inner = db.client.from(t);
      const origInsert = inner.insert;
      inner.insert = async (row) => {
        calls += 1;
        // Simulate a race: another request wrote the row between count and insert.
        db.rows.push({ user_id: row.user_id, ip_hash: 'ip-x', granted_seconds: 30, created_at: new Date().toISOString() });
        return origInsert(row);
      };
      return inner;
    },
  };
  const seconds = await resolveGuestTrialSeconds({ client, userId: 'u-race', ipHash: 'ip-x' });
  assert.equal(calls, 1);
  assert.equal(seconds, 30); // the concurrently-stored reduced grant wins
});

test('missing grants table falls back to the full trial (pre-migration deploy)', async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { code: 'PGRST205', message: 'Could not find the table' } }),
        }),
      }),
    }),
  };
  const seconds = await resolveGuestTrialSeconds({ client, userId: 'u1', ipHash: 'ip1' });
  assert.equal(seconds, GUEST_VOICE_LIMIT_SECONDS);
});

test('non-PGRST205 grant read errors still throw', async () => {
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }),
        }),
      }),
    }),
  };
  await assert.rejects(() => resolveGuestTrialSeconds({ client, userId: 'u1', ipHash: 'ip1' }), /trial grant read failed/);
});
