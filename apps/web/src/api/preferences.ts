import { getAccessToken } from './supabase';
import { backendUrl } from './api';
import type { Theme } from '@type/theme';

const preferenceHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const fetchRemoteTheme = async (): Promise<Theme | null> => {
  const response = await fetch(`${backendUrl}/api/preferences/theme`, {
    headers: await preferenceHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Theme read failed (${response.status})`);
  return (data?.theme as Theme | null) ?? null;
};

export const saveRemoteTheme = async (theme: Theme): Promise<void> => {
  const response = await fetch(`${backendUrl}/api/preferences/theme`, {
    method: 'PUT',
    headers: await preferenceHeaders(),
    body: JSON.stringify({ theme }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Theme save failed (${response.status})`);
};
