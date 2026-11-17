import { getAccessToken } from './supabase';

// Deployed panel defaults to the production API; set VITE_API_URL
// (e.g. http://localhost:3001) only for local backend development.
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? 'https://api.askpico.app';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export const adminFetch = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const token = await getAccessToken();
  const response = await fetch(`${apiUrl}/api/admin${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as Record<string, unknown> | null;
  if (!response.ok) {
    throw new ApiError(response.status, (data?.error as string) ?? `Request failed (${response.status})`);
  }
  return data as T;
};

// ── Types ────────────────────────────────────────────────────────────
export interface AdminStats {
  monthlySpendUsd: number;
  todaySpendUsd: number;
  todayTokens: number;
  monthlyBudgetUsd: number;
  dailyBudgetUsd: number;
  activeTesters: number;
  status: 'normal' | 'breaker';
  killSwitch: boolean;
  circuitBreaker: boolean;
}

export interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  joinedAt: string;
  role: string;
  status: 'active' | 'throttled' | 'banned';
  dailyTokenCap: number | null;
  totalTokens: number;
  riskBadge: 'flagged' | 'high_burner' | null;
  flagReason: string | null;
}

export interface AdminCoupon {
  code: string;
  discount_pct: number;
  months: number;
  plan: string;
  max_redemptions: number;
  redeemed_count: number;
  expires_at: string;
  created_at: string;
}

export interface AdminAnalytics {
  featureCounts: Record<string, number>;
  intentCounts: Record<string, number>;
  thumbsUp: number;
  thumbsDown: number;
  feedback: { text: string; at: string }[];
}
