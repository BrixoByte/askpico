// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const statusMock = vi.fn();
vi.mock('@utils/nativeAgent', () => ({
  focusStatus: () => statusMock(),
  focusSetEnabled: vi.fn(),
  focusSetupPasscode: vi.fn(() => ''),
  focusStart: vi.fn(() => true),
  focusBeginWait: vi.fn(),
  focusEarlyUnblock: vi.fn(() => 'OK'),
  focusEmergency: vi.fn(() => 'OK'),
  focusRecover: vi.fn(() => true),
  hasCapability: () => true,
  listLaunchableApps: () => [],
  openAppSettings: vi.fn(),
  requestAccess: vi.fn(),
}));

import FocusApps from './FocusApps';

const active = (unblocksLeft: number) => ({
  enabled: true,
  hasPasscode: true,
  lockRemainingMs: 0,
  active: true,
  blocking: true,
  endMs: Date.now() + 3_600_000,
  strength: 'BALANCED',
  score: 80,
  unblocksUsed: 2 - unblocksLeft,
  unblocksLeft,
  packages: ['com.whatsapp'],
});

afterEach(() => cleanup());

describe('FocusApps session texts', () => {
  it('shows the exact refusal message and hides unblock and emergency when none are left', () => {
    statusMock.mockReturnValue(active(0));
    render(<FocusApps />);
    expect(screen.getByText('No early unblocks left for this session.')).toBeTruthy();
    expect(screen.queryByText('Open an app now')).toBeNull();
    expect(screen.queryByText('Emergency: end session')).toBeNull();
  });

  it('offers unblock and emergency while unblocks remain', () => {
    statusMock.mockReturnValue(active(1));
    render(<FocusApps />);
    expect(screen.getByText('Open an app now')).toBeTruthy();
    expect(screen.getByText('Emergency: end session')).toBeTruthy();
    expect(screen.queryByText('No early unblocks left for this session.')).toBeNull();
  });

  it('shows the calm warning with Keep focusing as the default focus', () => {
    statusMock.mockReturnValue(active(1));
    render(<FocusApps />);
    fireEvent.click(screen.getByText('Open an app now'));
    expect(screen.getByText(/Opening this now lowers your focus score\. Continue\?/)).toBeTruthy();
    const keep = screen.getByText('Keep focusing');
    expect(document.activeElement).toBe(keep);
  });
});
