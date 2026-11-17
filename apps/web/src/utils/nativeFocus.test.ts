// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  focusEarlyUnblock,
  focusEmergency,
  focusStart,
  focusStatus,
  listLaunchableApps,
} from './nativeAgent';

type Bridge = Record<string, (...args: unknown[]) => unknown>;
const setBridge = (bridge: Bridge | undefined) => {
  (window as unknown as { PicoBridge?: Bridge }).PicoBridge = bridge;
};

afterEach(() => setBridge(undefined));

describe('focus wrappers', () => {
  it('returns a safe default status when the bridge is absent', () => {
    expect(focusStatus()).toEqual({ enabled: false, hasPasscode: false, lockRemainingMs: 0 });
  });

  it('parses the native status JSON', () => {
    setBridge({ focusStatus: () => JSON.stringify({ enabled: true, hasPasscode: true, lockRemainingMs: 0, active: true, score: 90, unblocksLeft: 1 }) });
    expect(focusStatus()).toMatchObject({ enabled: true, active: true, score: 90, unblocksLeft: 1 });
  });

  it('falls back to the default status on malformed JSON', () => {
    setBridge({ focusStatus: () => '{not json' });
    expect(focusStatus().enabled).toBe(false);
  });

  it('sends the session body as JSON and reports OK only on OK', () => {
    let sent = '';
    setBridge({ focusStart: (json: unknown) => { sent = String(json); return 'OK'; } });
    expect(focusStart(3_600_000, 'STRICT', ['com.whatsapp'])).toBe(true);
    expect(JSON.parse(sent)).toEqual({ lengthMs: 3_600_000, strength: 'STRICT', packages: ['com.whatsapp'] });
    setBridge({ focusStart: () => 'ERROR' });
    expect(focusStart(3_600_000, 'LIGHT', ['com.whatsapp'])).toBe(false);
  });

  it('returns the native outcome name for early unblock and emergency', () => {
    setBridge({ focusEarlyUnblock: () => 'NO_UNBLOCKS', focusEmergency: () => 'WAIT_REQUIRED' });
    expect(focusEarlyUnblock('x')).toBe('NO_UNBLOCKS');
    expect(focusEmergency('x')).toBe('WAIT_REQUIRED');
  });

  it('treats a missing bridge method as no session', () => {
    setBridge({});
    expect(focusEarlyUnblock('x')).toBe('NO_SESSION');
  });

  it('parses the launchable app list and returns [] when unavailable', () => {
    setBridge({ listLaunchableApps: () => '[{"package":"com.whatsapp","label":"WhatsApp"}]' });
    expect(listLaunchableApps()).toEqual([{ package: 'com.whatsapp', label: 'WhatsApp' }]);
    setBridge(undefined);
    expect(listLaunchableApps()).toEqual([]);
  });
});
