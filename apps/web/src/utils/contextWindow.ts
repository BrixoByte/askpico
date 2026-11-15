export const CONTEXT_WINDOW_SIZE = 10;

export const selectContextWindow = <T extends { role: string }>(
  messages: T[],
  size: number = CONTEXT_WINDOW_SIZE
): T[] => {
  const [first, ...rest] = messages;
  const system = first?.role === 'system' ? [first] : [];
  const body = system.length > 0 ? rest : messages;
  return [...system, ...body.slice(-size)];
};
