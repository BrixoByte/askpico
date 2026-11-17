// Client-side device-intent detector for the native shell. Conservative:
// only fires inside the Android app (window.PicoBridge present), only for the
// six beta actions, and only behind VITE_AGENT_ACTIONS=true. Desktop and voice
// paths are unaffected — a non-match returns null and normal chat proceeds.
import { isNativeApp, runAgentAction, type AgentActionName } from './nativeAgent';

// Static member access is required: Vite only replaces `import.meta.env.VITE_*`
// when it appears as a literal member expression. Build with
// `VITE_AGENT_ACTIONS=true vite build` to enable; unset means OFF.
export const AGENT_ACTIONS_ENABLED = import.meta.env.VITE_AGENT_ACTIONS === 'true';

interface DeviceIntent {
  action: AgentActionName;
  args: Record<string, string | number>;
  // Set when the user asked for an app that is not on the native allowlist.
  unsupportedApp?: string;
}

const APP_PACKAGES: Record<string, string> = {
  chrome: 'com.android.chrome',
  chromium: 'com.android.chrome',
  whatsapp: 'com.whatsapp',
  youtube: 'com.google.android.youtube',
  instagram: 'com.instagram.android',
  facebook: 'com.facebook.katana',
  tiktok: 'com.zhiliaoapp.musically',
};

// Keep '.' and ':' — they are load-bearing for URLs (https://example.com).
const normalize = (text: string) =>
  text.toLowerCase().replace(/[؟!;,]/g, ' ').replace(/\s+/g, ' ').trim();

const durSeconds = (n: number, unit: string): number => {
  const u = unit.toLowerCase();
  if (u.startsWith('hour') || u === 'hr' || u === 'ghanta') return n * 3600;
  if (u.startsWith('sec')) return n;
  return n * 60; // minute / min / minute default
};

export const detectDeviceIntent = (raw: string): DeviceIntent | null => {
  const text = normalize(raw);
  if (!text) return null;

  // call <number> — digits with optional + and separators, 3-20 chars.
  const call = text.match(/^(?:call|phone)\s+(?:on\s+)?(\+?[0-9][0-9\s\-()]{4,24}[0-9])\s*$/);
  if (call) {
    const number = call[1].replace(/[\s\-()]/g, '');
    if (/^\+?[0-9]{3,20}$/.test(number)) return { action: 'call', args: { number } };
    return null;
  }

  // open <url> / bare https URL
  const url = text.match(/(?:https?:\/\/[^\s]+|(?:www\.)?[a-z0-9-]+\.(?:com|net|org|io|pk|app|dev)(?:\/[^\s]*)?)/);
  if (/^(?:open|browse|visit|go to)\b/.test(text) && url) {
    const u = url[0].startsWith('http') ? url[0] : `https://${url[0]}`;
    return { action: 'open_url', args: { url: u } };
  }

  // timer: "set a timer for 10 minutes", "10 minute ka timer", "timer 5 min"
  const timer = text.match(/(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?|minute|ghante?|min)\b.*\btimer\b|\btimer\b.*?(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?|minute|ghante?|min)\b/);
  if (timer || /\b(set|start|lagao|lagani|banao)\b.*\btimer\b/.test(text)) {
    const m = timer ?? text.match(/(\d{1,4})\s*(minutes?|mins?|hours?|hrs?|seconds?|secs?|minute|ghante?|min)/);
    if (m) {
      const n = Number(m[1] ?? m[3]);
      const unit = m[2] ?? m[4] ?? 'minute';
      const seconds = durSeconds(n, unit);
      if (seconds >= 1 && seconds <= 86400) {
        return { action: 'set_timer', args: { seconds, label: text.slice(0, 100) } };
      }
    }
    return null; // "set a timer" with no duration: let chat handle it
  }

  // alarm: "set an alarm for 7:30", "alarm at 6 am", "6 baje ka alarm"
  const alarm = text.match(/\balarm\b.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?|(?:^|\s)(\d{1,2})(?::(\d{2}))?\s*(am|pm)\s+(?:baje\s+)?ka?\s*alarm/);
  if (/\b(set|lagao|lagani|banao|rakh)\b.*\balarm\b|\balarm\b.*\b(set|lagao|lagani|banao|rakh|at|for|baje)\b/.test(text) && alarm) {
    let hour = Number(alarm[1] ?? alarm[4]);
    const minute = Number(alarm[2] ?? alarm[5] ?? 0);
    const mer = (alarm[3] ?? alarm[6] ?? '').toLowerCase();
    if (mer === 'pm' && hour < 12) hour += 12;
    if (mer === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { action: 'set_alarm', args: { hour, minute, label: text.slice(0, 100) } };
    }
  }

  // open app (allowlist); unknown app names still produce open_app so the
  // native side can answer "not supported" instead of silently chatting.
  const app = text.match(/\b(?:open|launch|start|chalao|khol)\s+(?:the\s+|my\s+)?(?:app\s+)?([a-z]+)/);
  if (app) {
    const name = app[1].replace(/[^a-z]/g, '');
    const pkg = APP_PACKAGES[name];
    if (pkg) return { action: 'open_app', args: { package: pkg } };
    if (/^(?:chrome|whatsapp|youtube|instagram|facebook|tiktok)$/.test(name)) {
      return { action: 'open_app', args: { package: '' } };
    }
    return { action: 'open_app', args: { package: '' }, unsupportedApp: name };
  }

  // share on whatsapp
  if (/\bshare\b.*\bwhatsapp\b|\bwhatsapp\b.*\bshare\b|\bwhatsapp\s+pe\s+(?:share|bhej)/.test(text)) {
    return { action: 'share_whatsapp', args: { text: raw.slice(0, 4000) } };
  }

  return null;
};

const STATUS_TEXT: Record<string, string> = {
  done_open_app: 'Opening the app…',
  done_open_url: 'Opening the link…',
  done_set_alarm: 'Alarm set.',
  done_set_timer: 'Timer set.',
  done_share_whatsapp: 'Opening WhatsApp share…',
  done_call: 'Opening the dialer…',
  cancelled: 'Cancelled.',
  invalid: "I couldn't understand that action — try rephrasing it.",
  unsupported: "This device can't do that.",
  denied: 'Permission denied — check Pico app settings.',
};

export const statusText = (action: AgentActionName, status: string, unsupportedApp?: string): string => {
  if (status === 'denied' && (action === 'set_timer' || action === 'set_alarm')) {
    return "The Clock app on this phone does not allow this.";
  }
  if (unsupportedApp) return `"${unsupportedApp}" is not supported — only Chrome, WhatsApp, YouTube, Instagram, Facebook and TikTok can be opened.`;
  return STATUS_TEXT[`${status === 'done' ? 'done_' : ''}${action}`] ?? STATUS_TEXT[status] ?? `Action ${status}.`;
};

/**
 * Runs a detected device intent and returns the user-facing reply, or null
 * when the text is not a device action (normal chat should proceed).
 */
export const tryDeviceIntent = async (raw: string): Promise<string | null> => {
  if (!AGENT_ACTIONS_ENABLED || !isNativeApp()) return null;
  const intent = detectDeviceIntent(raw);
  if (!intent) return null;
  if (intent.unsupportedApp) return statusText(intent.action, 'unsupported', intent.unsupportedApp);
  if (intent.action === 'open_app' && !intent.args.package) {
    return 'That app is not supported — only Chrome, WhatsApp, YouTube, Instagram, Facebook and TikTok can be opened.';
  }
  const status = await runAgentAction(intent.action, intent.args);
  return statusText(intent.action, status);
};
