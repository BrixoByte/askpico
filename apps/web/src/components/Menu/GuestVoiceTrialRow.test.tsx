// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import useGuestVoiceStore from '@store/guest-voice-store';
import GuestVoiceTrialRow, { trialRowState } from './GuestVoiceTrialRow';

afterEach(() => {
  cleanup();
  useGuestVoiceStore.setState({ isGuest: null, remaining: null });
});

describe('sidebar voice trial row visibility', () => {
  it('is hidden for signed-in users, even with a balance', () => {
    expect(trialRowState(false, 120)).toEqual({ kind: 'hidden' });
    useGuestVoiceStore.setState({ isGuest: false, remaining: 120 });
    const { container } = render(<GuestVoiceTrialRow />);
    expect(container.innerHTML).toBe('');
  });

  it('is hidden while the guest balance is still loading', () => {
    expect(trialRowState(true, null)).toEqual({ kind: 'hidden' });
  });

  it('shows the countdown for guests', () => {
    useGuestVoiceStore.setState({ isGuest: true, remaining: 120 });
    render(<GuestVoiceTrialRow />);
    expect(screen.getByRole('status').textContent).toBe('Voice trial: 2:00 left');
    expect(screen.getByRole('status').getAttribute('aria-label')).toBe('Voice trial: 2:00 left');
  });

  it('shows "Voice trial used" with a Sign in button when the balance is zero', () => {
    useGuestVoiceStore.setState({ isGuest: true, remaining: 0 });
    render(<GuestVoiceTrialRow />);
    expect(screen.getByText('Voice trial used')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in to keep using voice' }).textContent).toBe('Sign in');
  });
});
