import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { adminFetch, AdminAnalytics } from '../lib/api';

const COLORS = ['#7c5ce0', '#38bdf8', '#f59e0b', '#ef4444', '#10b981', '#f97316'];

const toPie = (counts: Record<string, number>) =>
  Object.entries(counts).map(([name, value]) => ({ name, value }));

const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className='rounded-2xl border border-surface-line bg-surface-card p-5'>
    <h3 className='text-xs font-medium uppercase tracking-wide text-ink-muted'>{title}</h3>
    <div className='mt-4 h-56'>{children}</div>
  </div>
);

const Analytics = () => {
  const [data, setData] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<AdminAnalytics>('/analytics')
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);

  if (error) return <p className='rounded-lg bg-red-500/10 px-4 py-2 text-xs text-red-300'>{error}</p>;
  if (!data) return <p className='text-sm text-ink-muted'>Loading analytics…</p>;

  const quality = [
    { name: 'Thumbs up', value: data.thumbsUp },
    { name: 'Thumbs down', value: data.thumbsDown },
  ];

  return (
    <div className='space-y-5'>
      <h1 className='text-lg font-semibold'>Analytics & Intent</h1>

      <div className='grid grid-cols-1 gap-4 lg:grid-cols-3'>
        <ChartCard title='Feature usage'>
          {toPie(data.featureCounts).length === 0 ? (
            <p className='flex h-full items-center justify-center text-xs text-ink-muted'>No requests logged yet</p>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={toPie(data.featureCounts)} dataKey='value' nameKey='name' innerRadius={50} outerRadius={80}>
                  {toPie(data.featureCounts).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #232332', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title='Query intent breakdown'>
          {toPie(data.intentCounts).length === 0 ? (
            <p className='flex h-full items-center justify-center text-xs text-ink-muted'>Classifier has not tagged any requests yet</p>
          ) : (
            <ResponsiveContainer>
              <BarChart data={toPie(data.intentCounts)}>
                <XAxis dataKey='name' tick={{ fill: '#7a7a8c', fontSize: 11 }} />
                <YAxis tick={{ fill: '#7a7a8c', fontSize: 11 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #232332', borderRadius: 8 }} />
                <Bar dataKey='value' radius={[6, 6, 0, 0]}>
                  {toPie(data.intentCounts).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title='Reply quality ratio'>
          {data.thumbsUp + data.thumbsDown === 0 ? (
            <p className='flex h-full items-center justify-center text-xs text-ink-muted'>No ratings yet</p>
          ) : (
            <ResponsiveContainer>
              <PieChart>
                <Pie data={quality} dataKey='value' nameKey='name' innerRadius={50} outerRadius={80}>
                  <Cell fill='#10b981' />
                  <Cell fill='#ef4444' />
                </Pie>
                <Tooltip contentStyle={{ background: '#16161f', border: '1px solid #232332', borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className='rounded-2xl border border-surface-line bg-surface-card p-5'>
        <h3 className='text-xs font-medium uppercase tracking-wide text-ink-muted'>
          Feedback inspector — thumbs-down comments
        </h3>
        {data.feedback.length === 0 ? (
          <p className='mt-4 text-sm text-ink-muted'>No negative feedback recorded.</p>
        ) : (
          <ul className='mt-4 divide-y divide-surface-line/60'>
            {data.feedback.map((f, i) => (
              <li key={i} className='py-3'>
                <p className='text-sm text-ink'>{f.text}</p>
                <p className='mt-1 text-xs text-ink-muted'>{new Date(f.at).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default Analytics;
