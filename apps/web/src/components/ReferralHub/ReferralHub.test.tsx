// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReferralHub from './ReferralHub';

describe('ReferralHub', () => {
  it('truncates metric labels so they do not clip at large font scales', () => {
    render(
      <ReferralHub
        isSignedIn
        referralLink='https://go.askpico.app/?ref=T'
        stats={{ clicks: 1, signups: 2, freeSignups: 2, paidUpgrades: 3, successful: 1, pending: 1, earnedSeconds: 120 }}
        error={null}
      />
    );
    const label = screen.getByText('Paid upgrades');
    expect(label.className).toContain('truncate');
  });
});
