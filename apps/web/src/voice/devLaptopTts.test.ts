import { describe, expect, it } from 'vitest';
import { devLaptopTtsUrl } from './devLaptopTts';

const DEV = true;
const PROD = false;

describe('devLaptopTtsUrl', () => {
  it('returns null when the flag is unset, even in a dev build', () => {
    expect(devLaptopTtsUrl({ DEV })).toBeNull();
    expect(devLaptopTtsUrl({ DEV, VITE_DEV_LAPTOP_TTS: 'false' })).toBeNull();
  });

  it('returns null in a non-dev build even when the flag is set', () => {
    expect(
      devLaptopTtsUrl({
        DEV: PROD,
        VITE_DEV_LAPTOP_TTS: 'true',
        VITE_LAPTOP_TTS_URL: 'http://localhost:8787',
      }),
    ).toBeNull();
  });

  it('returns null in a non-dev build with flag and no URL', () => {
    expect(devLaptopTtsUrl({ DEV: PROD, VITE_DEV_LAPTOP_TTS: 'true' })).toBeNull();
  });

  it('dev build + flag selects the laptop service URL', () => {
    expect(
      devLaptopTtsUrl({
        DEV,
        VITE_DEV_LAPTOP_TTS: 'true',
        VITE_LAPTOP_TTS_URL: 'http://localhost:8787/',
      }),
    ).toBe('http://localhost:8787/tts');
  });

  it('dev build + flag falls back to the default local URL', () => {
    expect(devLaptopTtsUrl({ DEV, VITE_DEV_LAPTOP_TTS: 'true' })).toBe(
      'http://localhost:8787/tts',
    );
  });
});
