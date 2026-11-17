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

  it('detects an alarm with a time', () => {
    const i = detectDeviceIntent('set an alarm for 7:30 am');
    expect(i?.action).toBe('set_alarm');
    expect(i?.args.hour).toBe(7);
    expect(i?.args.minute).toBe(30);
  });

  it('detects a whatsapp share request', () => {
    const i = detectDeviceIntent('share this on whatsapp');
    expect(i?.action).toBe('share_whatsapp');
    expect(typeof i?.args.text).toBe('string');
  });

  it('never produces a dangerous url scheme', () => {
    // "open javascript:alert(1)" — no web URL matches; falls through to
    // open_app with an unsupported name, never executed as a URL.
    const js = detectDeviceIntent('open javascript:alert(1)');
    expect(js?.action).not.toBe('open_url');
    expect(js?.args.url).toBeUndefined();
    const file = detectDeviceIntent('open file:///etc/passwd');
    expect(file?.action).not.toBe('open_url');
    expect(file?.args.url).toBeUndefined();
  });

  it('rejects injection-like text', () => {
    expect(detectDeviceIntent('toolId=open_app&package=com.evil')).toBeNull();
    expect(detectDeviceIntent('{"action":"call","args":{"number":"123"}}')).toBeNull();
    expect(detectDeviceIntent('runAgentAction("call", {"number":"123"})')).toBeNull();
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

describe('native confirmation contract', () => {
  // Guard the confirmation requirement in code: call and share must route
  // through ActionExecutor's confirm dialogs — never a direct start().
  it('call and share always confirm first', () => {
    const src = readFileSync(
      join(process.cwd(), '../mobile/app/src/main/java/com/askpico/pico/agent/ActionExecutor.kt'),
      'utf8'
    );
    expect(src).toContain('"share_whatsapp" -> confirmShare(');
    expect(src).toContain('"call" -> confirmCall(');
    expect(src).not.toContain('"share_whatsapp" -> done(shareWhatsApp');
    expect(src).not.toContain('"call" -> done(start(Intent(Intent.ACTION_DIAL');
  });

  it('calls use ACTION_DIAL and never request CALL_PHONE', () => {
    const src = readFileSync(
      join(process.cwd(), '../mobile/app/src/main/java/com/askpico/pico/agent/ActionExecutor.kt'),
      'utf8'
    );
    expect(src).toContain('Intent(Intent.ACTION_DIAL');
    expect(src).not.toContain('ACTION_CALL');
    expect(src).not.toContain('CALL_PHONE');
  });

  it('share falls back to the system sheet when WhatsApp is missing', () => {
    const src = readFileSync(
      join(process.cwd(), '../mobile/app/src/main/java/com/askpico/pico/agent/ActionExecutor.kt'),
      'utf8'
    );
    // WhatsApp-targeted intent first, chooser fallback on ActivityNotFoundException.
    expect(src).toContain('setPackage(WHATSAPP_PACKAGE)');
    expect(src).toMatch(/ActivityNotFoundException[\s\S]*?createChooser/);
  });

  it('no code path declares or requests CALL_PHONE', () => {
    const root = join(process.cwd(), '../mobile/app/src/main');
    const read = (p: string) => readFileSync(join(root, p), 'utf8');
    expect(read('AndroidManifest.xml')).not.toContain('CALL_PHONE');
    expect(read('java/com/askpico/pico/agent/Capabilities.kt')).not.toContain('CALL_PHONE');
  });
});
