// The per-agent picker was removed. Its persisted selection filtered the Recent list
// to chats whose lastAgentId matched, which could hide every chat. Clearing the key
// once restores the single unified history. Chats themselves are never modified.
export const LEGACY_AGENT_SELECTION_KEY = 'pico-agent-selection';

export const clearLegacyAgentSelection = (storage: Storage = localStorage): boolean => {
  if (storage.getItem(LEGACY_AGENT_SELECTION_KEY) === null) return false;
  storage.removeItem(LEGACY_AGENT_SELECTION_KEY);
  return true;
};
