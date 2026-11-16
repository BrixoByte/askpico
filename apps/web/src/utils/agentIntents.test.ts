// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AGENT_ACTIONS_ENABLED,
  detectDeviceIntent,
  statusText,
} from './agentIntents';

describe('AGENT_ACTIONS_ENABLED', () => {
  it('defaults to OFF when the env flag is unset', () => {
    expect(AGENT_ACTIONS_ENABLED).toBe(false);
  });

  it('uses static import.meta.env member access (Vite-replaceable)', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/utils/agentIntents.ts'),
      'utf8'
    );
    // A dynamic key or object pass-through compiles to `{}.VITE_*` in the
    // bundle and can never be enabled. Guard the literal member form.
    expect(src).toContain("import.meta.env.VITE_AGENT_ACTIONS === 'true'");
    expect(src).not.toContain('import.meta.env[');
    expect(src).not.toMatch(/=\s*import\.meta\.env\s*[,;\n)]/);
  });
});

describe('detectDeviceIntent', () => {
  it('detects a phone call', () => {
    const i = detectDeviceIntent('call +923001234567');
    expect(i?.action).toBe('call');
    expect(i?.args.number).toBe('+923001234567');
  });

  it('detects an https url', () => {
    const i = detectDeviceIntent('open https://example.com/path');
    expect(i?.action).toBe('open_url');
    expect(i?.args.url).toBe('https://example.com/path');
  });

  it('detects a timer with duration', () => {
    const i = detectDeviceIntent('set a timer for 5 minutes');
    expect(i?.action).toBe('set_timer');
    expect(i?.args.seconds).toBe(300);
  });

  it('detects an allowlisted app', () => {
    const i = detectDeviceIntent('open chrome');
    expect(i?.action).toBe('open_app');
    expect(i?.args.package).toBe('com.android.chrome');
  });

  it('flags unsupported apps', () => {
    const i = detectDeviceIntent('open myspace app');
    expect(i?.action).toBe('open_app');
    expect(i?.unsupportedApp).toBe('myspace');
  });

  it('returns null for normal chat text', () => {
    expect(detectDeviceIntent('what is the capital of France?')).toBeNull();
    expect(detectDeviceIntent('set up a study plan for exams')).toBeNull();
  });
});

describe('statusText', () => {
  it('explains Clock denial for timer/alarm', () => {
    expect(statusText('set_timer', 'denied')).toContain('Clock app');
    expect(statusText('set_alarm', 'denied')).toContain('Clock app');
  });

  it('names unsupported apps', () => {
    expect(statusText('open_app', 'unsupported', 'myspace')).toContain('myspace');
  });
});
