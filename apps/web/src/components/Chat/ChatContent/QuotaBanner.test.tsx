// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('@api/api', () => ({ fetchReferralCode: async () => 'TESTCODE' }));

import useUsageStore from '@store/usage-store';
import QuotaBanner from './QuotaBanner';

afterEach(() => {
  cleanup();
  useUsageStore.setState({ quotaOpen: false, quotaKind: null });
});

describe('QuotaBanner', () => {
  it('shows the daily-limit copy for the cap kind, not the busy copy', () => {
    useUsageStore.setState({ quotaOpen: true, quotaKind: 'cap' });
    render(<QuotaBanner />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Daily limit reached');
    expect(banner.textContent).toContain('resets at midnight');
    expect(banner.textContent).not.toContain('Service is busy');
    expect(banner.textContent).not.toContain('handling too many requests');
  });

  it('shows the busy copy for the busy kind', () => {
    useUsageStore.setState({ quotaOpen: true, quotaKind: 'busy' });
    render(<QuotaBanner />);
    const banner = screen.getByRole('status');
    expect(banner.textContent).toContain('Service is busy');
    expect(banner.textContent).toContain('handling too many requests');
  });

  it('stays hidden when closed', () => {
    useUsageStore.setState({ quotaOpen: false, quotaKind: 'cap' });
    render(<QuotaBanner />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
