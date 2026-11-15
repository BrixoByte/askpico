import { useCallback, useEffect, useState } from 'react';
import { Power, Plus, Ticket, X } from 'lucide-react';
import { adminFetch, AdminCoupon, AdminStats } from '../lib/api';
import { useOutletContext } from 'react-router-dom';

const Settings = () => {
  const { stats, reloadStats } = useOutletContext<{
    stats: AdminStats | null;
    reloadStats: (s: AdminStats) => void;
  }>();
  const [coupons, setCoupons] = useState<AdminCoupon[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ prefix: 'PROMO', count: 1, discountPct: 50, months: 3, maxRedemptions: 1 });

  const loadCoupons = useCallback(() => {
    adminFetch<{ coupons: AdminCoupon[] }>('/coupons')
      .then((r) => setCoupons(r.coupons))
      .catch((e: Error) => setError(e.message));
  }, []);

  useEffect(loadCoupons, [loadCoupons]);

  const killSwitch = async (paused: boolean) => {
    if (
      paused &&
      !window.confirm('PAUSE all LLM requests for every user? Use only during a budget or abuse emergency.')
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/kill-switch', { method: 'POST', body: JSON.stringify({ paused }) });
      const fresh = await adminFetch<AdminStats>('/stats');
      reloadStats(fresh);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const expireCoupon = async (code: string) => {
    if (!window.confirm(`Expire coupon ${code}?`)) return;
    try {
      await adminFetch(`/coupons/${code}`, { method: 'DELETE' });
      loadCoupons();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const createCoupons = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminFetch('/coupons', {
        method: 'POST',
        body: JSON.stringify({
          code: form.prefix || undefined,
          count: form.count,
          discountPct: form.discountPct,
          months: form.months,
          maxRedemptions: form.maxRedemptions,
        }),
      });
      setModal(false);
      loadCoupons();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className='space-y-6'>
      <h1 className='text-lg font-semibold'>Coupons & System Config</h1>

      {error && <p className='rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-300'>{error}</p>}

      {/* Master kill switch */}
      <div className='rounded-2xl border border-red-500/30 bg-red-500/5 p-5'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <h2 className='flex items-center gap-2 text-sm font-semibold text-red-300'>
              <Power size={15} /> Master kill-switch
            </h2>
            <p className='mt-1 text-xs text-ink-muted'>
              Immediately pauses every outgoing LLM request across web, mobile, and desktop.
            </p>
          </div>
          <button
            onClick={() => void killSwitch(!(stats?.killSwitch ?? false))}
            disabled={busy || !stats}
            className={`rounded-xl px-5 py-2.5 text-sm font-bold uppercase tracking-wide transition-colors disabled:opacity-50 ${
              stats?.killSwitch
                ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {stats?.killSwitch ? 'Resume requests' : 'Pause all requests'}
          </button>
        </div>
      </div>

      {/* Coupons */}
      <div className='rounded-2xl border border-surface-line bg-surface-card'>
        <div className='flex items-center justify-between border-b border-surface-line px-5 py-4'>
          <h2 className='flex items-center gap-2 text-sm font-semibold'>
            <Ticket size={15} /> Promo coupons
          </h2>
          <button
            onClick={() => setModal(true)}
            className='flex items-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600'
          >
            <Plus size={13} /> Generate codes
          </button>
        </div>
        <div className='overflow-x-auto'>
          <table className='w-full text-left text-sm'>
            <thead className='text-xs text-ink-muted'>
              <tr className='border-b border-surface-line'>
                <th className='px-5 py-3 font-medium'>Code</th>
                <th className='px-5 py-3 font-medium'>Discount</th>
                <th className='px-5 py-3 font-medium'>Plan</th>
                <th className='px-5 py-3 font-medium'>Used</th>
                <th className='px-5 py-3 font-medium'>Expires</th>
                <th className='px-5 py-3 font-medium' />
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => {
                const expired = new Date(c.expires_at) < new Date();
                const usedUp = c.redeemed_count >= c.max_redemptions;
                return (
                  <tr key={c.code} className='border-b border-surface-line/60 last:border-0'>
                    <td className='px-5 py-3 font-mono text-xs font-semibold text-ink'>{c.code}</td>
                    <td className='px-5 py-3 text-ink-soft'>
                      {c.discount_pct}% · {c.months} mo
                    </td>
                    <td className='px-5 py-3 text-ink-soft'>{c.plan}</td>
                    <td className='px-5 py-3'>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          usedUp ? 'bg-surface-line text-ink-muted' : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {c.redeemed_count}/{c.max_redemptions}
                      </span>
                    </td>
                    <td className='px-5 py-3 text-ink-soft'>
                      {new Date(c.expires_at).toLocaleDateString()}
                      {expired && <span className='ml-2 text-xs text-red-400'>(expired)</span>}
                    </td>
                    <td className='px-5 py-3 text-right'>
                      {!expired && !usedUp && (
                        <button
                          onClick={() => void expireCoupon(c.code)}
                          className='text-xs text-ink-muted transition-colors hover:text-red-300'
                        >
                          expire
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {coupons.length === 0 && (
                <tr>
                  <td colSpan={6} className='px-5 py-8 text-center text-sm text-ink-muted'>
                    No coupons yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate modal */}
      {modal && (
        <div
          className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4'
          onMouseDown={() => setModal(false)}
        >
          <div
            className='w-full max-w-sm rounded-2xl border border-surface-line bg-surface-card p-6'
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className='flex items-center justify-between'>
              <h3 className='text-sm font-semibold'>Generate promo codes</h3>
              <button onClick={() => setModal(false)} className='text-ink-muted hover:text-ink'>
                <X size={16} />
              </button>
            </div>
            <div className='mt-4 space-y-3 text-sm'>
              <label className='block'>
                <span className='text-xs text-ink-muted'>Prefix (blank = PROMO)</span>
                <input
                  value={form.prefix}
                  onChange={(e) => setForm({ ...form, prefix: e.target.value.toUpperCase() })}
                  className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 uppercase outline-none focus:border-brand-500'
                />
              </label>
              <div className='grid grid-cols-2 gap-3'>
                <label className='block'>
                  <span className='text-xs text-ink-muted'>Count</span>
                  <input
                    type='number'
                    min={1}
                    max={50}
                    value={form.count}
                    onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
                    className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 outline-none focus:border-brand-500'
                  />
                </label>
                <label className='block'>
                  <span className='text-xs text-ink-muted'>Discount %</span>
                  <input
                    type='number'
                    min={1}
                    max={100}
                    value={form.discountPct}
                    onChange={(e) => setForm({ ...form, discountPct: Number(e.target.value) })}
                    className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 outline-none focus:border-brand-500'
                  />
                </label>
                <label className='block'>
                  <span className='text-xs text-ink-muted'>Free months</span>
                  <input
                    type='number'
                    min={1}
                    max={24}
                    value={form.months}
                    onChange={(e) => setForm({ ...form, months: Number(e.target.value) })}
                    className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 outline-none focus:border-brand-500'
                  />
                </label>
                <label className='block'>
                  <span className='text-xs text-ink-muted'>Max redemptions</span>
                  <input
                    type='number'
                    min={1}
                    value={form.maxRedemptions}
                    onChange={(e) => setForm({ ...form, maxRedemptions: Number(e.target.value) })}
                    className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 outline-none focus:border-brand-500'
                  />
                </label>
              </div>
              <p className='text-xs text-ink-muted'>
                Codes expire Dec 31, 2026 (default). Plan: Pro Monthly.
              </p>
              <button
                onClick={() => void createCoupons()}
                disabled={busy}
                className='w-full rounded-lg bg-brand-500 px-4 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50'
              >
                {busy ? 'Creating…' : 'Create codes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
