import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Activity, BarChart3, LayoutDashboard, LogOut, Settings, Users } from 'lucide-react';
import { adminFetch, AdminStats } from '../lib/api';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const DashboardLayout = () => {
  const { email, signOut } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);

  // Poll stats for the daily-cost alarm + health badge; the panel must show
  // a live picture, not a snapshot of when the page first loaded.
  useEffect(() => {
    let mounted = true;
    const load = () =>
      adminFetch<AdminStats>('/stats')
        .then((s) => mounted && setStats(s))
        .catch(() => undefined);
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const overDaily = stats ? stats.todaySpendUsd >= stats.dailyBudgetUsd : false;

  return (
    <div className='flex min-h-screen'>
      <aside className='flex w-56 flex-col border-r border-surface-line bg-surface-soft'>
        <div className='flex items-center gap-2 px-5 py-5'>
          <span className='flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 text-brand-400'>
            <Activity size={16} />
          </span>
          <span className='text-sm font-semibold'>Pico Admin</span>
        </div>
        <nav className='flex-1 space-y-1 px-3'>
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-300'
                    : 'text-ink-soft hover:bg-surface-card hover:text-ink'
                }`
              }
            >
              <item.icon size={16} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className='border-t border-surface-line px-5 py-4'>
          <p className='truncate text-xs text-ink-muted'>{email}</p>
          <button
            onClick={() => void signOut()}
            className='mt-2 flex items-center gap-2 text-xs text-ink-soft transition-colors hover:text-ink'
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </aside>

      <div className='flex flex-1 flex-col'>
        {overDaily && (
          <div className='animate-pulse border-b border-amber-500/30 bg-amber-500/10 px-5 py-2 text-center text-xs font-medium text-amber-300'>
            Daily cost alarm — today's spend ${stats!.todaySpendUsd.toFixed(2)} is over the $
            {stats!.dailyBudgetUsd.toFixed(2)}/day threshold.
          </div>
        )}
        {stats?.status === 'breaker' && (
          <div className='border-b border-red-500/30 bg-red-500/10 px-5 py-2 text-center text-xs font-semibold text-red-300'>
            Circuit breaker active — LLM requests are paused.
          </div>
        )}
        <main className='flex-1 overflow-y-auto p-6'>
          <Outlet context={{ stats, reloadStats: setStats }} />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
