import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import SunIcon from '@icon/SunIcon';
import MoonIcon from '@icon/MoonIcon';
import { resolveTheme } from '@utils/theme';

const ThemeSwitcher = () => {
  const { t } = useTranslation();
  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  // Quick toggle flips between explicit light/dark (exits 'system' mode).
  const resolved = resolveTheme(theme);
  const opposite = resolved === 'dark' ? 'light' : 'dark';

  const switchTheme = () => {
    setTheme(opposite);
  };

  return theme ? (
    <button
      className='items-center gap-3 btn btn-neutral'
      onClick={switchTheme}
      aria-label='toggle dark/light mode'
    >
      {resolved === 'dark' ? <SunIcon /> : <MoonIcon />}
      {t(opposite + 'Mode')}
    </button>
  ) : (
    <></>
  );
};

export default ThemeSwitcher;
