import { getAccessToken } from './supabase';
import { backendUrl } from './api';

const memoryHeaders = async (): Promise<Record<string, string>> => {
  const token = await getAccessToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const fetchRemoteMemory = async (): Promise<string[]> => {
  const response = await fetch(`${backendUrl}/api/memory`, {
    headers: await memoryHeaders(),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Memory read failed (${response.status})`);
  return (data.items as string[]) ?? [];
};

export const saveRemoteMemory = async (items: string[]): Promise<void> => {
  const response = await fetch(`${backendUrl}/api/memory`, {
    method: 'PUT',
    headers: await memoryHeaders(),
    body: JSON.stringify({ items }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error ?? `Memory save failed (${response.status})`);
};
