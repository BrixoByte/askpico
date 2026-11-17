// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

// window.PicoMemory.onLowMemory is installed as a side effect of importing
// nativeAgent; the latch is module state, so each case gets a fresh module.
const load = async () => {
  vi.resetModules();
  const m = await import('./nativeAgent');
  return m;
};

interface PicoMemWindow {
  PicoMemory?: { onLowMemory: (level: number) => void };
}

describe('low-memory latch', () => {
  beforeEach(() => {
    delete (window as unknown as PicoMemWindow).PicoMemory;
  });

  it('ignores levels below RUNNING_LOW', async () => {
    const m = await load();
    (window as unknown as PicoMemWindow).PicoMemory?.onLowMemory(5); // RUNNING_MODERATE
    expect(m.isLowMemoryMode()).toBe(false);
  });

  it('latches at RUNNING_LOW and notifies subscribers', async () => {
    const m = await load();
    const seen: number[] = [];
    m.subscribeLowMemory(() => seen.push(1));
    (window as unknown as PicoMemWindow).PicoMemory?.onLowMemory(10);
    expect(m.isLowMemoryMode()).toBe(true);
    expect(seen).toHaveLength(1);
    // Latched: a second signal does not re-fire listeners.
    (window as unknown as PicoMemWindow).PicoMemory?.onLowMemory(15);
    expect(seen).toHaveLength(1);
  });

  it('latches at CRITICAL', async () => {
    const m = await load();
    (window as unknown as PicoMemWindow).PicoMemory?.onLowMemory(20);
    expect(m.isLowMemoryMode()).toBe(true);
  });
});
