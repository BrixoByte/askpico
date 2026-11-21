// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import ReferralHub from './ReferralHub';
import type { ReferralStats } from '@api/api';

const baseStats: ReferralStats = {
  clicks: 1,
  signups: 2,
  freeSignups: 2,
  paidUpgrades: 3,
  successful: 1,
  pending: 1,
  earnedSeconds: 120,
};

const renderHub = (stats: ReferralStats) =>
  render(
    <ReferralHub
      isSignedIn
      referralLink='https://go.askpico.app/?ref=T'
      stats={stats}
      error={null}
    />
  );

const bonusValue = () => {
  const label = screen.getByText('Bonus minutes');
  const card = label.parentElement as HTMLElement;
  return card.querySelectorAll('div')[1].textContent;
};

afterEach(cleanup);

describe('ReferralHub', () => {
  it('truncates metric labels so they do not clip at large font scales', () => {
    renderHub(baseStats);
    const label = screen.getByText('Paid upgrades');
    expect(label.className).toContain('truncate');
  });

  it('shows 0 bonus minutes when earnedSeconds is missing', () => {
    const stats = { ...baseStats } as Partial<ReferralStats>;
    delete stats.earnedSeconds;
    renderHub(stats as ReferralStats);
    expect(bonusValue()).toBe('0');
  });

  it('shows 0 bonus minutes when earnedSeconds is null', () => {
    renderHub({ ...baseStats, earnedSeconds: null as unknown as number });
    expect(bonusValue()).toBe('0');
  });

  it('shows 0 bonus minutes when earnedSeconds is 0', () => {
    renderHub({ ...baseStats, earnedSeconds: 0 });
    expect(bonusValue()).toBe('0');
  });

  it('shows the floored minutes for a normal bonus value', () => {
    renderHub({ ...baseStats, earnedSeconds: 150 });
    expect(bonusValue()).toBe('2');
  });

  it('truncates metric hints so they do not clip at large font scales', () => {
    renderHub(baseStats);
    for (const hint of ['Referred, on free plan', 'Referred, on a paid plan']) {
      const el = screen.getByText(hint);
      expect(el.className).toContain('truncate');
    }
  });
});
