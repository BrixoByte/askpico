import { Theme } from '@type/theme';

export type ResolvedTheme = 'light' | 'dark';

export const resolveTheme = (theme: Theme): ResolvedTheme =>
  theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : theme;
