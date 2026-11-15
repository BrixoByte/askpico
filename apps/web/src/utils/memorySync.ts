import useMemoryStore from '@store/memory-store';
import { fetchRemoteMemory, saveRemoteMemory } from '@api/memory';
import { isSignedInSession } from '@api/supabase';
import { logger } from '@utils/logger';

let started = false;

export const startMemorySync = (): void => {
  if (started) return;
  started = true;

  let lastSynced: string | null = null;

  const pushIfChanged = (texts: string[]) => {
    const key = JSON.stringify(texts);
    if (key === lastSynced) return;
    lastSynced = key;
    saveRemoteMemory(texts).catch((err: unknown) =>
      logger.warn('memory save failed', (err as Error).message)
    );
  };

  isSignedInSession()
    .then(async (signedIn) => {
      if (!signedIn) return;
      const remote = await fetchRemoteMemory();
      const local = useMemoryStore.getState().items.map((item) => item.text);
      const merged = remote.length > 0 ? remote : local;
      lastSynced = JSON.stringify(merged);
      useMemoryStore.getState().replaceItems(merged);
      if (remote.length === 0 && local.length > 0) pushIfChanged(local);
    })
    .catch((err: unknown) => logger.warn('memory load failed', (err as Error).message));

  useMemoryStore.subscribe((state, prev) => {
    if (state.items === prev.items) return;
    if (!useMemoryStore.getState().memoryEnabled) return;
    isSignedInSession().then((signedIn) => {
      if (signedIn) pushIfChanged(state.items.map((item) => item.text));
    });
  });
};
