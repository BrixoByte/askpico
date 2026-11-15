import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const Login = () => {
  const { loading, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAdmin) return <Navigate to='/' replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!supabase || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    // AuthProvider verifies the admin role via /api/admin/check; the
    // onAuthStateChange listener then routes us into the dashboard.
    navigate('/');
  };

  return (
    <div className='flex min-h-screen items-center justify-center px-4'>
      <form
        onSubmit={onSubmit}
        className='w-full max-w-sm rounded-2xl border border-surface-line bg-surface-card p-8 shadow-xl'
      >
        <div className='mb-6 flex items-center gap-3'>
          <span className='flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400'>
            <Shield size={20} />
          </span>
          <div>
            <h1 className='text-lg font-semibold text-ink'>Pico Admin</h1>
            <p className='text-xs text-ink-muted'>Restricted — admin accounts only</p>
          </div>
        </div>

        <label className='block text-xs font-medium text-ink-soft'>Email</label>
        <input
          type='email'
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 text-sm text-ink outline-none focus:border-brand-500'
        />

        <label className='mt-4 block text-xs font-medium text-ink-soft'>Password</label>
        <input
          type='password'
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className='mt-1 w-full rounded-lg border border-surface-line bg-surface-soft px-3 py-2 text-sm text-ink outline-none focus:border-brand-500'
        />

        {error && <p className='mt-3 text-xs text-red-400'>{error}</p>}
        {!loading && !isAdmin && !error && supabase && (
          <p className='mt-3 text-xs text-ink-muted'>
            Sign in with an account whose profile has the admin role.
          </p>
        )}

        <button
          type='submit'
          disabled={submitting}
          className='mt-6 w-full rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50'
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
};

export default Login;
