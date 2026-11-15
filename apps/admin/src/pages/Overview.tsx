import { Activity, AlertTriangle, Flame, Shield, Users } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { AdminStats } from '../lib/api';

const usd = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}`;

const Card = ({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) => (
  <div className='rounded-2xl border border-surface-line bg-surface-card p-5'>
    <div className='flex items-center gap-2 text-xs font-medium text-ink-muted'>
      {icon}
      {title}
    </div>
    <div className='mt-3'>{children}</div>
  </div>
);

const Overview = () => {
  const { stats } = useOutletContext<{ stats: AdminStats | null }>();

  if (!stats) {
    return <p className='text-sm text-ink-muted'>Loading live stats…</p>;
  }

  const pct = Math.min((stats.monthlySpendUsd / stats.monthlyBudgetUsd) * 100, 100);
  const status =
    stats.killSwitch || stats.circuitBreaker
      ? { label: 'Circuit Breaker Active', cls: 'bg-red-500/15 text-red-300 border-red-500/40' }
      : stats.todaySpendUsd >= stats.dailyBudgetUsd
        ? { label: 'Throttled', cls: 'bg-amber-500/15 text-amber-300 border-amber-500/40' }
        : { label: 'Normal', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };

  return (
    <div className='space-y-5'>
      <h1 className='text-lg font-semibold'>Live Health</h1>

      <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
        <Card title='Global Budget (monthly)' icon={<Activity size={14} />}>
          <div className='flex items-baseline gap-2'>
            <span className='text-2xl font-semibold'>{usd(stats.monthlySpendUsd)}</span>
            <span className='text-xs text-ink-muted'>/ {usd(stats.monthlyBudgetUsd)}</span>
          </div>
          <div className='mt-3 h-2 overflow-hidden rounded-full bg-surface-line'>
            <div
              className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-brand-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className='mt-1.5 text-xs text-ink-muted'>{pct.toFixed(1)}% of budget</p>
        </Card>

        <Card title='Active Beta Testers (7d)' icon={<Users size={14} />}>
          <span className='text-2xl font-semibold'>{stats.activeTesters}</span>
          <p className='mt-1.5 text-xs text-ink-muted'>users with requests this week</p>
        </Card>

        <Card title="Today's Burn" icon={<Flame size={14} />}>
          <span className='text-2xl font-semibold'>{usd(stats.todaySpendUsd)}</span>
          <p className='mt-1.5 text-xs text-ink-muted'>
            {stats.todayTokens.toLocaleString()} tokens today · cap {usd(stats.dailyBudgetUsd)}/day
          </p>
        </Card>

        <Card title='System Status' icon={<Shield size={14} />}>
          <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${status.cls}`}>
            <AlertTriangle size={12} />
            {status.label}
          </span>
          <p className='mt-2.5 text-xs text-ink-muted'>
            kill switch: {stats.killSwitch ? 'ON' : 'off'} · breaker: {stats.circuitBreaker ? 'tripped' : 'armed'}
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Overview;
