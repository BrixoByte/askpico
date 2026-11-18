import { ShareGPTSubmitBodyInterface } from '@type/api';
import { ImageAspectRatio, MessageInterface, ModelOptions } from '@type/chat';
import useStore from '@store/store';
import { markGuestTrialOver, TRIAL_OVER_MESSAGE } from '@store/guest-voice-store';
import { getAccessToken } from './supabase';

// Default: the API lives on the same host as this page, port 3001. Works for
// desktop dev (localhost), Android emulator (10.0.2.2), and adb reverse
// (localhost). Set VITE_BACKEND_URL to override (e.g. production deploys).
export const backendUrl =
  import.meta.env.VITE_BACKEND_URL ||
  `${window.location.protocol}//${window.location.hostname}:3001`;

export const fetchWithRetry = async (
  input: string,
  init?: RequestInit,
  attempts = 6,
  baseDelayMs = 500
): Promise<Response> => {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      if (init?.signal?.aborted || attempt >= attempts || !(err instanceof TypeError)) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1)));
    }
  }
};

export interface VerificationResult {
  corrected: string;
  flagged: number;
}

export const verifyReplyText = async (
  reply: string,
  focus: string,
  userText: string
): Promise<VerificationResult> => {
  const response = await fetch(`${backendUrl}/api/chat/verify`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ reply, focus, userText }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Verification failed (${response.status})`);
  return data as VerificationResult;
};

export const compileArtifactTailwind = async (sources: string[]): Promise<string> => {
  const response = await fetchWithRetry(`${backendUrl}/api/artifact/css`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sources }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Tailwind compile failed (${response.status})`);
  return (data as { css: string }).css;
};

export const submitArtifactForm = async (body: {
  artifactId: string;
  formId: string | null;
  submittedAt: string;
  fields: Record<string, string>;
}): Promise<boolean> => {
  const response = await fetchWithRetry(`${backendUrl}/api/artifact/submission`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return response.ok;
};

export type RoutingMode = ModelOptions;

export const getChatCompletion = async (messages: MessageInterface[], mode: RoutingMode = 'auto', memories: string[] = [], chatId?: string) => {
  const response = await fetchWithRetry(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ messages, mode: mode === 'auto' ? undefined : mode, memories, chatId }),
  });
  if (!response.ok) throw new Error(await response.text());

  const data = await response.json();
  return data;
};

const authHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export interface RouteResult {
  agentId: string | null;
  toolId?: string;
  location?: 'backend' | 'external' | 'browser';
  data?: unknown;
  toolError?: string;
}

export interface ThreadContext {
  focus?: string;
  recent?: { role: 'user' | 'assistant'; content: string }[];
  stickyAgentId?: string | null;
}

export const summarizeThreadFocus = async (
  previous: string,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<string> => {
  const response = await fetchWithRetry(`${backendUrl}/api/thread/focus`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ previous, messages }),
  });
  if (!response.ok) throw new Error(`Thread summary failed (${response.status})`);
  const data = await response.json();
  return data.focus as string;
};

export class SignInRequiredError extends Error {}

export const routeToAgent = async (
  message: string,
  fileExtensions: string[] = [],
  context: ThreadContext = {}
): Promise<RouteResult | null> => {
  const response = await fetchWithRetry(`${backendUrl}/api/agent/route`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({
      message,
      fileExtensions,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...context,
    }),
  });
  const data = await response.json().catch(() => null);
  if (response.status === 403 && data?.code === 'signin_required') {
    throw new SignInRequiredError(data.error);
  }
  if (response.status === 422) throw new Error(data?.error ?? 'Tool routing failed');
  if (!response.ok) return null;
  return data ?? null;
};

export const truncateAgentHistory = async (chatId: string, fromTurn: number): Promise<void> => {
  const response = await fetchWithRetry(`${backendUrl}/api/agent/truncate`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ chatId, fromTurn }),
  });
  if (!response.ok) throw new Error(`History cleanup failed (${response.status})`);
};

export const askSpecialistAgent = async (
  agentId: string,
  message: string,
  chatId: string,
  turn: number,
  mode: RoutingMode = 'auto',
  requestType: 'text' | 'voice' = 'text',
  memories: string[] = [],
  context: ThreadContext = {}
): Promise<string> => {
  const response = await fetchWithRetry(`${backendUrl}/api/agent/chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ agentId, chatId, turn, message, mode: mode === 'auto' ? undefined : mode, requestType, memories, ...context }),
  });
  const data = await response.json().catch(() => null);
  if (data?.error === 'GUEST_VOICE_LIMIT') {
    markGuestTrialOver();
    throw new Error(TRIAL_OVER_MESSAGE);
  }
  if (!response.ok) throw new Error(data?.error ?? `Agent request failed (${response.status})`);
  return data.reply as string;
};

export const extractAttachmentText = async (name: string, dataBase64: string): Promise<string> => {
  const response = await fetch(`${backendUrl}/api/attachments/extract`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ name, dataBase64 }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Attachment failed (${response.status})`);
  return data.text as string;
};

export interface ChatStreamResult {
  stream: ReadableStream<Uint8Array> | null;
  // The routing tier that actually served the request. When the caller asked
  // for 'deep' but the server's quota granted a lower tier, this differs.
  grantedMode: string | null;
}

export const getChatCompletionStream = async (
  messages: MessageInterface[],
  mode: RoutingMode = 'auto',
  memories: string[] = [],
  focus?: string,
  maxTokens?: number,
  chatId?: string,
  requestType: 'text' | 'voice' = 'text'
): Promise<ChatStreamResult> => {
  const response = await fetchWithRetry(`${backendUrl}/api/chat`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ messages, mode: mode === 'auto' ? undefined : mode, stream: true, memories, focus, maxTokens, chatId, requestType, replyLanguage: useStore.getState().replyLanguage }),
  });

  if (!response.ok) {
    const text = await response.text();
    let error = text;
    let busy = false;
    let trialOver = false;
    try {
      const body = JSON.parse(text);
      busy = body.code === 'UPSTREAM_BUSY';
      trialOver = body.error === 'GUEST_VOICE_LIMIT';
    } catch { /* not JSON */ }
    if (trialOver) {
      markGuestTrialOver();
      error = TRIAL_OVER_MESSAGE;
    } else if (busy) error = 'Service is busy. Please try again.';
    else if (response.status === 429) error += '\nRate limited!';
    throw new Error(error);
  }

  return {
    stream: response.body,
    grantedMode: response.headers.get('x-pico-mode'),
  };
};

export interface ImageProviderInterface {
  id: string;
  label: string;
}

export interface GeneratedImageInterface {
  mimeType: string;
  dataBase64: string;
  provider: string;
  model: string;
}

export const fetchImageProviders = async (): Promise<ImageProviderInterface[]> => {
  const response = await fetchWithRetry(`${backendUrl}/api/image/providers`);
  if (!response.ok) throw new Error(`Failed to load image providers (${response.status})`);
  const data = await response.json();
  return data.providers as ImageProviderInterface[];
};

// Not retried automatically: each call may be billed by the provider.
export const generateImage = async (body: {
  provider: string;
  prompt: string;
  aspectRatio: ImageAspectRatio;
}): Promise<GeneratedImageInterface> => {
  const response = await fetch(`${backendUrl}/api/image/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Image generation failed (${response.status})`);
  return data as GeneratedImageInterface;
};

export interface CouponCheck {
  status: 'valid' | 'invalid' | 'expired' | 'used';
  discountPct?: number;
  months?: number;
  plan?: string;
}

export const validateCoupon = async (code: string): Promise<CouponCheck> => {
  const response = await fetch(
    `${backendUrl}/api/coupons/validate?code=${encodeURIComponent(code)}`,
    { headers: await authHeaders() }
  );
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Coupon check failed (${response.status})`);
  return data as CouponCheck;
};

export const claimReferral = async (code: string, deviceId: string): Promise<{ status: string }> => {
  const response = await fetch(`${backendUrl}/api/referral/claim`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ code, deviceId }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Referral claim failed (${response.status})`);
  return data as { status: string };
};

export interface ReferralStats {
  clicks: number;
  signups: number;
  freeSignups: number;
  paidUpgrades: number;
  successful: number;
  pending: number;
  earnedSeconds: number;
}

export const recordReferralClick = async (code: string): Promise<void> => {
  await fetch(`${backendUrl}/api/referral/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
};

export const fetchReferralStats = async (): Promise<ReferralStats> => {
  const response = await fetch(`${backendUrl}/api/referral/stats`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Referral stats failed (${response.status})`);
  return data as ReferralStats;
};

export interface UsageSummary {
  plan: 'free' | 'weekly' | 'monthly';
  tokensUsed: number;
  tokenLimit: number | null;
  voiceUsedSeconds: number;
  voiceLimitSeconds: number | null;
  bonusVoiceSeconds: number;
}

export const fetchUsage = async (): Promise<UsageSummary> => {
  const response = await fetch(`${backendUrl}/api/usage`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Usage failed (${response.status})`);
  return data as UsageSummary;
};

export const notifyVoiceSessionComplete = async (): Promise<void> => {
  const response = await fetch(`${backendUrl}/api/voice/session-complete`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!response.ok) throw new Error(`Voice session report failed (${response.status})`);
};

// Guest voice trial. The server decides; these return the balance or the refusal code.
export type GuestVoiceResult = { ok: true; remainingSeconds: number } | { ok: false; code: string };

const guestVoiceRequest = async (path: string, body?: unknown): Promise<GuestVoiceResult> => {
  const response = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers: await authHeaders(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (response.ok) return { ok: true, remainingSeconds: Number(data?.remainingSeconds ?? 0) };
  return { ok: false, code: data?.error ?? `HTTP_${response.status}` };
};

export const startGuestVoice = (): Promise<GuestVoiceResult> => guestVoiceRequest('/api/voice/session-start');

export const sendGuestVoiceHeartbeat = (seconds: number, reason?: 'beat' | 'pause' | 'end'): Promise<GuestVoiceResult> =>
  guestVoiceRequest('/api/voice/heartbeat', { seconds, reason });

// Signed-in users: the route debits a fixed HEARTBEAT_SECONDS per call, so the
// `seconds` claim is guest-only and deliberately omitted. `reason` is a log label.
export const sendVoiceHeartbeat = (reason?: 'beat' | 'pause' | 'end'): Promise<GuestVoiceResult> =>
  guestVoiceRequest('/api/voice/heartbeat', { reason });

// Null when the balance cannot be read; the sidebar row then stays hidden rather than guessing.
export const fetchGuestVoiceTrial = async (): Promise<number | null> => {
  const response = await fetch(`${backendUrl}/api/voice/trial`, { headers: await authHeaders() });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.guest) return null;
  return Number(data.remainingSeconds ?? 0);
};

export const fetchReferralCode = async (): Promise<string> => {
  const response = await fetch(`${backendUrl}/api/referral/code`, {
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Referral code failed (${response.status})`);
  return (data as { code: string }).code;
};

export const deleteAccount = async (): Promise<void> => {
  const response = await fetch(`${backendUrl}/api/account`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Account deletion failed (${response.status})`);
};

export const submitShareGPT = async (body: ShareGPTSubmitBodyInterface) => {
  const request = await fetch('https://sharegpt.com/api/conversations', {
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });

  const response = await request.json();
  const { id } = response;
  const url = `https://shareg.pt/${id}`;
  window.open(url, '_blank');
};
