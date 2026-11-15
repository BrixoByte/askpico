import { useCallback, useEffect, useState } from 'react';
import { adminFetch, AdminUser } from '../lib/api';
import { Ban, Gauge, RotateCcw, Undo2 } from 'lucide-react';

type Filter = 'all' | 'high_burner' | 'flagged';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All testers' },
  { key: 'high_burner', label: 'High token burners' },
  { key: 'flagged', label: 'Flagged / spam' },
];

const statusBadge = (u: AdminUser) => {
  if (u.status === 'banned') return 'bg-red-500/15 text-red-300';
  if (u.status === 'throttled') return 'bg-amber-500/15 text-amber-300';
  return 'bg-emerald-500/15 text-emerald-300';
};

const Users = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    adminFetch<{ users: AdminUser[] }>(`/users?filter=${filter}&limit=100`)
      .then((r) => setUsers(r.users))
      .catch((e: Error) => setError(e.message));
  }, [filter]);

  useEffect(load, [load]);

  const act = async (userId: string, action: () => Promise<unknown>) => {
    setBusy(userId);
    setError(null);
    try {
      await action();
      load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleBan = (u: AdminUser) =>
    act(u.id, () =>
      adminFetch(`/users/${u.id}/ban`, {
        method: 'POST',
        body: JSON.stringify({ banned: u.status !== 'banned' }),
      })
    );

  const throttle = (u: AdminUser) => {
    if (u.status === 'throttled') {
      void act(u.id, () =>
        adminFetch(`/users/${u.id}/throttle`, { method: 'POST', body: JSON.stringify({ dailyTokenCap: null }) })
      );
      return;
    }
    const input = window.prompt(`Daily token cap for ${u.email ?? u.name} (e.g. 50000):`, '50000');
    const cap = input === null ? null : Number(input);
    if (cap == null || !Number.isInteger(cap) || cap <= 0) return;
    void act(u.id, () =>
      adminFetch(`/users/${u.id}/throttle`, { method: 'POST', body: JSON.stringify({ dailyTokenCap: cap }) })
    );
  };

  const resetMemory = (u: AdminUser) => {
    if (!window.confirm(`Wipe memory vault for ${u.email ?? u.name}? This cannot be undone.`)) return;
    void act(u.id, () => adminFetch(`/users/${u.id}/reset-memory`, { method: 'POST' }));
  };

  return (
    <div className='space-y-5'>
      <div className='flex items-center justify-between'>
        <h1 className='text-lg font-semibold'>Users & Testers</h1>
        <div className='flex gap-1 rounded-lg border border-surface-line bg-surface-card p-1'>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filter === f.key ? 'bg-brand-500/20 text-brand-300' : 'text-ink-muted hover:text-ink'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className='rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-300'>{error}</p>}

      <div className='overflow-x-auto rounded-2xl border border-surface-line'>
        <table className='w-full text-left text-sm'>
          <thead className='border-b border-surface-line bg-surface-card text-xs text-ink-muted'>
            <tr>
              <th className='px-4 py-3 font-medium'>Email</th>
              <th className='px-4 py-3 font-medium'>Joined</th>
              <th className='px-4 py-3 font-medium'>Tokens</th>
              <th className='px-4 py-3 font-medium'>Status</th>
              <th className='px-4 py-3 font-medium'>Risk</th>
              <th className='px-4 py-3 font-medium'>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className='border-b border-surface-line/60 last:border-0'>
                <td className='px-4 py-3'>
                  <div className='font-medium text-ink'>{u.email ?? '(no email)'}</div>
                  <div className='text-xs text-ink-muted'>{u.name || u.id.slice(0, 8)}</div>
                </td>
                <td className='px-4 py-3 text-ink-soft'>
                  {new Date(u.joinedAt).toLocaleDateString()}
                </td>
                <td className='px-4 py-3 text-ink-soft'>{u.totalTokens.toLocaleString()}</td>
                <td className='px-4 py-3'>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge(u)}`}>
                    {u.status}
                    {u.dailyTokenCap ? ` · ${u.dailyTokenCap.toLocaleString()}/d` : ''}
                  </span>
                </td>
                <td className='px-4 py-3'>
                  {u.riskBadge === 'flagged' && (
                    <span className='rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-medium text-red-300'>
                      {u.flagReason ?? 'flagged'}
                    </span>
                  )}
                  {u.riskBadge === 'high_burner' && (
                    <span className='rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300'>
                      high burner
                    </span>
                  )}
                </td>
                <td className='px-4 py-3'>
                  <div className='flex gap-2'>
                    <button
                      onClick={() => throttle(u)}
                      disabled={busy === u.id}
                      title={u.status === 'throttled' ? 'Lift throttle' : 'Set token cap'}
                      className='rounded-lg border border-surface-line p-1.5 text-ink-soft transition-colors hover:border-amber-500/50 hover:text-amber-300 disabled:opacity-40'
                    >
                      <Gauge size={14} />
                    </button>
                    <button
                      onClick={() => void toggleBan(u)}
                      disabled={busy === u.id}
                      title={u.status === 'banned' ? 'Unban' : 'Ban'}
                      className='rounded-lg border border-surface-line p-1.5 text-ink-soft transition-colors hover:border-red-500/50 hover:text-red-300 disabled:opacity-40'
                    >
                      {u.status === 'banned' ? <Undo2 size={14} /> : <Ban size={14} />}
                    </button>
                    <button
                      onClick={() => resetMemory(u)}
                      disabled={busy === u.id}
                      title='Reset memory vault'
                      className='rounded-lg border border-surface-line p-1.5 text-ink-soft transition-colors hover:border-brand-500/50 hover:text-brand-300 disabled:opacity-40'
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className='px-4 py-8 text-center text-sm text-ink-muted'>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Users;
