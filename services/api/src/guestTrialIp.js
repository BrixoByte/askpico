import { createHmac } from 'node:crypto';

// Full guest voice trials granted per client IP per rolling 24h. CGNAT means many
// real users share one IP, so the cap is deliberately soft: past it, new guests get
// the reduced trial instead of the full one. Chat is never affected.
export const GUEST_TRIAL_IP_CAP = 8;
export const GUEST_TRIAL_REDUCED_SECONDS = 30;
export const GUEST_TRIAL_CAP_WINDOW_MS = 24 * 60 * 60 * 1000;

// Fraud signals are stored as keyed hashes, never as raw IPs or device IDs.
export const hashSignal = (value) =>
  createHmac('sha256', process.env.REFERRAL_HASH_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '')
    .update(value)
    .digest('hex');

// Best-effort client IP: first X-Forwarded-For hop, else the direct peer.
// A determined caller can spoof XFF — this is a soft cap, not a hard block.
export const clientIp = (req) => {
  const xff = req.headers?.['x-forwarded-for'];
  const first = Array.isArray(xff) ? xff[0] : xff;
  return (typeof first === 'string' && first.split(',')[0].trim()) || req.ip || req.socket?.remoteAddress || '';
};

// IPv6 callers are grouped by /64 (the typical per-site allocation) so rotating the
// interface-id does not evade the cap. IPv4 is used whole; IPv4-mapped IPv6 collapses
// to the IPv4 form.
export const normalizeClientIp = (ip) => {
  const raw = String(ip ?? '').trim().toLowerCase();
  if (!raw) return '';
  if (!raw.includes(':')) return raw;
  const v4 = raw.match(/::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) return v4[1];
  const [leftPart, rightPart] = raw.split('::');
  const left = leftPart ? leftPart.split(':') : [];
  const right = rightPart ? rightPart.split(':') : [];
  const fill = Math.max(8 - left.length - right.length, 0);
  const groups = [...left, ...Array(fill).fill('0'), ...right];
  return `${groups.slice(0, 4).join(':')}::/64`;
};

// Keyed hash of the normalized IP — raw IPs are never stored or logged.
export const hashGuestIp = (ip) => {
  const normalized = normalizeClientIp(ip);
  return normalized ? hashSignal(`trial-ip:${normalized}`) : null;
};
