// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';

const fetchTool = vi.fn();
vi.mock('@api/tools', () => ({ fetchTool: (tool: string, params?: Record<string, string>) => fetchTool(tool, params) }));

import LiveCurrency from './LiveCurrency';

const coinGeckoPrices = {
  bitcoin: { usd: 91234.5, usd_24h_change: 1.23 },
  ethereum: { usd: 3021.4, usd_24h_change: -0.85 },
  solana: { usd: 142.77 },
};

// Shape returned when FREECRYPTOAPI_KEY is set on the server: the adapter passes
// the raw upstream body through, which is a `symbols` array, not a price map.
const freeCryptoApiPrices = {
  status: 'success',
  symbols: [
    { symbol: 'BTC', last: '91234.50' },
    { symbol: 'ETH', last: '3021.40' },
    { symbol: 'SOL', last: '142.77' },
  ],
};

const currencyOk = { base: 'USD', updatedAt: 'Sat, 21 Nov 2026 00:00:02 +0000', rates: { PKR: 281.5, EUR: 0.86 } };

const mockTools = ({ fx, coins }: { fx: unknown; coins: unknown }) => {
  fetchTool.mockImplementation((tool: string) =>
    Promise.resolve(tool === 'currency' ? fx : coins)
  );
};

afterEach(() => {
  cleanup();
  fetchTool.mockReset();
});

describe('LiveCurrency', () => {
  it('renders rates and CoinGecko-shaped crypto prices', async () => {
    mockTools({ fx: currencyOk, coins: { updatedAt: Date.now(), source: 'CoinGecko', prices: coinGeckoPrices } });
    render(<LiveCurrency />);
    await waitFor(() => expect(screen.getByText('281.50')).toBeTruthy());
    expect(screen.getByText('bitcoin')).toBeTruthy();
    expect(screen.getByText('91,234.5')).toBeTruthy();
    expect(screen.getByText(/1\.23%/)).toBeTruthy();
  });

  it('renders crypto prices from the FreeCryptoAPI symbols shape', async () => {
    mockTools({ fx: currencyOk, coins: { updatedAt: Date.now(), source: 'FreeCryptoAPI', prices: freeCryptoApiPrices } });
    render(<LiveCurrency />);
    await waitFor(() => expect(screen.getByText('BTC')).toBeTruthy());
    expect(screen.getByText('ETH')).toBeTruthy();
    expect(screen.getByText('SOL')).toBeTruthy();
    expect(screen.getByText('281.50')).toBeTruthy();
  });

  it('shows a safe message instead of throwing when crypto prices are missing', async () => {
    mockTools({ fx: currencyOk, coins: { updatedAt: Date.now(), source: 'CoinGecko' } });
    render(<LiveCurrency />);
    await waitFor(() => expect(screen.getByText('281.50')).toBeTruthy());
    expect(screen.getByText('Prices unavailable')).toBeTruthy();
  });

  it('shows a safe message instead of throwing when currency rates are missing', async () => {
    mockTools({ fx: { base: 'USD', updatedAt: 'x' }, coins: { prices: coinGeckoPrices } });
    render(<LiveCurrency />);
    await waitFor(() => expect(screen.getByText('Rates unavailable')).toBeTruthy());
  });
});
