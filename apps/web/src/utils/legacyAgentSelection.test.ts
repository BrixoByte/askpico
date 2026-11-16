import { describe, expect, it } from 'vitest';
import { LEGACY_AGENT_SELECTION_KEY, clearLegacyAgentSelection } from './legacyAgentSelection';

const memoryStorage = (init: Record<string, string>) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k: string) => (data.has(k) ? data.get(k)! : null),
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  } as unknown as Storage;
};

describe('legacy agent selection migration', () => {
  it('removes a persisted activeAgentId so chats are no longer filtered', () => {
    const chats = Array.from({ length: 13 }, (_, i) => ({ id: `c${i}`, title: `New Chat ${i}`, lastAgentId: null }));
    const storage = memoryStorage({
      [LEGACY_AGENT_SELECTION_KEY]: JSON.stringify({ state: { activeAgentId: 'live' }, version: 0 }),
      'free-chat-gpt': JSON.stringify({ state: { chats } }),
    });
    expect(clearLegacyAgentSelection(storage)).toBe(true);
    expect(storage.getItem(LEGACY_AGENT_SELECTION_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem('free-chat-gpt')!).state.chats).toHaveLength(13);
  });

  it('is a no-op after the first run', () => {
    const storage = memoryStorage({});
    expect(clearLegacyAgentSelection(storage)).toBe(false);
  });
});
