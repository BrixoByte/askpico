// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  hasCapability,
  isNativeApp,
  runAgentAction,
  setShieldRules,
  vaultHas,
  vaultSet,
} from './nativeAgent';

interface MockBridge {
  performAction?: (action: string, argsJson: string) => string;
  vaultSet?: (key: string, value: string) => boolean;
  vaultHas?: (key: string) => boolean;
  setShield?: (rulesJson: string) => boolean;
  hasCapability?: (feature: string) => boolean;
}

const w = window as unknown as {
  PicoBridge?: MockBridge;
  PicoAction?: { onResult?: (id: string, status: string) => void };
};

afterEach(() => {
  delete w.PicoBridge;
});

describe('bridge absence', () => {
  it('reports not-native and safe defaults without a bridge', () => {
    expect(isNativeApp()).toBe(false);
    expect(hasCapability('usage')).toBe(false);
    expect(vaultSet('note:ref_x', 'secret')).toBe(false);
    expect(vaultHas('note:ref_x')).toBe(false);
    expect(setShieldRules({ enabled: true, packages: [] })).toBe(false);
  });

  it('runAgentAction resolves unsupported without a bridge', async () => {
    await expect(runAgentAction('open_url', { url: 'https://x.com' })).resolves.toBe('unsupported');
  });
});

describe('runAgentAction', () => {
  it('resolves the status posted to PicoAction.onResult', async () => {
    w.PicoBridge = {
      performAction: () => JSON.stringify({ id: 'id-1', status: 'queued' }),
    };
    const pending = runAgentAction('set_timer', { seconds: 60, label: 'tea' });
    w.PicoAction?.onResult?.('id-1', 'done');
    await expect(pending).resolves.toBe('done');
  });

  it('resolves synchronous non-queued statuses immediately', async () => {
    w.PicoBridge = {
      performAction: () => JSON.stringify({ id: 'id-2', status: 'invalid' }),
    };
    await expect(runAgentAction('open_app', { package: 'com.evil' })).resolves.toBe('invalid');
  });

  it('passes args verbatim — vault refs travel as opaque ids, never resolved in JS', async () => {
    let sent = '';
    w.PicoBridge = {
      performAction: (_action: string, argsJson: string) => {
        sent = argsJson;
        return JSON.stringify({ id: 'id-3', status: 'queued' });
      },
    };
    const pending = runAgentAction('share_whatsapp', { text: 'note:ref_91c' });
    w.PicoAction?.onResult?.('id-3', 'sent');
    await pending;
    expect(JSON.parse(sent)).toEqual({ text: 'note:ref_91c' });
    expect(sent).not.toContain('secret');
  });

  it('ignores results for unknown ids and malformed replies resolve unsupported', async () => {
    w.PicoBridge = { performAction: () => 'not json' };
    await expect(runAgentAction('call', { number: '911' })).resolves.toBe('unsupported');
    w.PicoAction?.onResult?.('nobody', 'done'); // must not throw
  });
});

describe('vault + shield bridge calls', () => {
  it('vaultSet/vaultHas forward to the bridge', () => {
    const store = new Map<string, string>();
    w.PicoBridge = {
      vaultSet: (k, v) => {
        store.set(k, v);
        return true;
      },
      vaultHas: (k) => store.has(k),
    };
    expect(vaultSet('contact:ref_7f3', '03001234567')).toBe(true);
    expect(vaultHas('contact:ref_7f3')).toBe(true);
    expect(vaultHas('contact:ref_other')).toBe(false);
  });

  it('setShieldRules serializes the payload for the bridge', () => {
    let raw = '';
    w.PicoBridge = {
      setShield: (rulesJson) => {
        raw = rulesJson;
        return true;
      },
    };
    expect(setShieldRules({ enabled: true, packages: ['com.instagram.android'] })).toBe(true);
    expect(JSON.parse(raw)).toEqual({ enabled: true, packages: ['com.instagram.android'] });
  });

  it('a throwing bridge returns safe defaults, never raises', () => {
    w.PicoBridge = {
      hasCapability: () => {
        throw new Error('bridge dead');
      },
      performAction: () => {
        throw new Error('bridge dead');
      },
    };
    expect(hasCapability('overlay')).toBe(false);
    return expect(runAgentAction('open_url', { url: 'https://x.com' })).resolves.toBe('unsupported');
  });
});
