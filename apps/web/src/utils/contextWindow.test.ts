import { describe, expect, it } from 'vitest';
import { CONTEXT_WINDOW_SIZE, selectContextWindow } from './contextWindow';

const turns = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: `m${i}`,
  }));

describe('selectContextWindow', () => {
  it('keeps only the last 10 messages of a long thread', () => {
    const result = selectContextWindow(turns(25));
    expect(result).toHaveLength(CONTEXT_WINDOW_SIZE);
    expect(result[0].content).toBe('m15');
    expect(result[result.length - 1].content).toBe('m24');
  });

  it('keeps a leading system message and does not count it toward the window', () => {
    const messages = [{ role: 'system', content: 'sys' }, ...turns(25)];
    const result = selectContextWindow(messages);
    expect(result[0]).toEqual({ role: 'system', content: 'sys' });
    expect(result).toHaveLength(CONTEXT_WINDOW_SIZE + 1);
    expect(result[result.length - 1].content).toBe('m24');
  });

  it('returns short threads unchanged', () => {
    const messages = turns(4);
    expect(selectContextWindow(messages)).toEqual(messages);
  });

  it('handles an empty thread', () => {
    expect(selectContextWindow([])).toEqual([]);
  });
});
