import React, { useEffect, useState } from 'react';
import { fetchTool } from '@api/tools';

interface CurrencyResult {
  base: string;
  updatedAt: string;
  rates?: Record<string, number>;
}

interface CryptoResult {
  updatedAt: number;
  prices?: unknown;
}

interface CoinRow {
  id: string;
  price: number | null;
  change: number | null;
}

const WATCH = ['PKR', 'EUR', 'GBP', 'AED', 'SAR', 'INR'];

const toNum = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Normalizes both upstream shapes the /api/tools/crypto adapter can return:
// CoinGecko  -> {bitcoin:{usd,usd_24h_change}, ...}
// FreeCryptoAPI (keyed path) -> {status, symbols:[{symbol,last,...}]}
const coinRows = (prices: unknown): CoinRow[] => {
  if (!prices || typeof prices !== 'object') return [];
  const p = prices as Record<string, unknown>;
  if (Array.isArray(p.symbols)) {
    return p.symbols
      .filter((s): s is Record<string, unknown> => !!s && typeof s === 'object')
      .map((s) => ({
        id: String(s.symbol ?? s.name ?? '?'),
        price: toNum(s.last ?? s.price ?? s.usd),
        change: toNum(s.last_change ?? s.change_24h ?? s.usd_24h_change),
      }));
  }
  return Object.entries(p).map(([id, v]) => {
    const o = v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
    return {
      id,
      price: toNum(o ? (o.usd ?? o.price ?? o.last) : v),
      change: o ? toNum(o.usd_24h_change) : null,
    };
  });
};

const LiveCurrency = () => {
  const [rates, setRates] = useState<CurrencyResult | null>(null);
  const [crypto, setCrypto] = useState<CryptoResult | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [fx, coins] = await Promise.all([
          fetchTool<CurrencyResult>('currency', { base: 'USD' }),
          fetchTool<CryptoResult>('crypto'),
        ]);
        if (!cancelled) {
          setRates(fx);
          setCrypto(coins);
          setError('');
        }
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      }
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  if (error) return <p className='text-sm text-red-600'>{error}</p>;
  if (!rates || !crypto) return <p className='text-sm text-ink-muted'>Loading rates...</p>;

  const coins = coinRows(crypto.prices);

  return (
    <div className='flex flex-col gap-3 rounded-2xl border border-surface-line bg-surface p-4 text-sm'>
      <div>
        <p className='mb-1 font-medium text-ink'>Currency (1 USD)</p>
        {rates.rates ? (
          <ul className='flex flex-col gap-1 text-ink-soft'>
            {WATCH.map((code) => (
              <li key={code} className='flex justify-between'>
                <span>{code}</span>
                <span className='font-mono'>{rates.rates?.[code]?.toFixed(2) ?? 'n/a'}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-ink-muted'>Rates unavailable</p>
        )}
      </div>
      <div>
        <p className='mb-1 font-medium text-ink'>Crypto (USD)</p>
        {coins.length ? (
          <ul className='flex flex-col gap-1 text-ink-soft'>
            {coins.map((c) => (
              <li key={c.id} className='flex justify-between'>
                <span className='capitalize'>{c.id}</span>
                <span className='font-mono'>
                  {c.price === null ? 'n/a' : c.price.toLocaleString()}
                  {typeof c.change === 'number' && (
                    <span className={c.change >= 0 ? 'text-green-600' : 'text-red-600'}>
                      {' '}({c.change.toFixed(2)}%)
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className='text-ink-muted'>Prices unavailable</p>
        )}
      </div>
      <p className='text-xs text-ink-muted'>
        Gold (beta): free key-less source abhi final nahi hua, is liye yahan nahi dikhaya gaya.
      </p>
    </div>
  );
};

export default LiveCurrency;
