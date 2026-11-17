// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import OfflineBanner, { setForcedOffline } from './OfflineBanner';

const setOnline = (value: boolean) =>
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });

afterEach(() => {
  cleanup();
  setOnline(true);
  act(() => {
    setForcedOffline(false);
  });
});

describe('offline banner', () => {
  it('stays hidden while online', () => {
    setOnline(true);
    render(<OfflineBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('appears on the offline event and disappears when back online, without touching the session', () => {
    setOnline(true);
    render(<OfflineBanner />);
    setOnline(false);
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.getByRole('status').textContent).toContain('You are offline');
    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('shows while the simulated-offline hook is on, even though navigator.onLine is true', () => {
    setOnline(true);
    render(<OfflineBanner />);
    act(() => {
      setForcedOffline(true);
    });
    expect(screen.getByRole('status').textContent).toContain('You are offline');
    act(() => {
      setForcedOffline(false);
    });
    expect(screen.queryByRole('status')).toBeNull();
  });
});
