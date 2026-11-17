import React, { useState } from 'react';
import { supabase } from '@api/supabase';

const inputClass =
  'mobile-auth-input w-full rounded-xl border border-zinc-300 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:border-brand-500 focus:outline-none dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600';

const Spinner = () => (
  <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' aria-hidden='true' />
);

// Shown when Supabase fires PASSWORD_RECOVERY (user arrived via the emailed
// reset link). Lets them set a new password on the recovery session.
const ResetPasswordModal = ({ onClose }: { onClose: () => void }) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
      return setError('Password must include a letter and a number.');
    if (password !== confirm) return setError('Passwords do not match.');
    if (!supabase) return setError('Password reset is not available right now.');
    setSending(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        const text = updateError.message.toLowerCase();
        if (text.includes('same') || text.includes('weak'))
          return setError('Choose a different, stronger password.');
        if (text.includes('rate limit') || text.includes('too many'))
          return setError('Too many attempts. Please wait a minute and try again.');
        return setError('Could not update the password. The link may have expired — request a new one.');
      }
      setDone(true);
    } catch {
      setError('Could not update the password. Check your connection and try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className='fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'>
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='reset-password-title'
        className='w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900'
      >
        <h2 id='reset-password-title' className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
          Set a new password
        </h2>
        {done ? (
          <div className='mt-4 flex flex-col gap-4'>
            <p className='rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'>
              Your password has been updated. You are signed in.
            </p>
            <button
              type='button'
              onClick={onClose}
              className="relative rounded-xl bg-brand-600 px-4 py-2.5 after:absolute after:-inset-y-1 after:content-['']  text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Continue
            </button>
          </div>
        ) : (
          <div className='mt-4 flex flex-col gap-4'>
            {error && (
              <p role='alert' className='rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'>
                {error}
              </p>
            )}
            <div>
              <label htmlFor='reset-password' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
                New password
              </label>
              <input
                id='reset-password'
                type='password'
                autoComplete='new-password'
                placeholder='At least 8 characters'
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor='reset-password-confirm' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
                Confirm password
              </label>
              <input
                id='reset-password-confirm'
                type='password'
                autoComplete='new-password'
                placeholder='Re-enter your password'
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void submit();
                  }
                }}
                className={inputClass}
              />
            </div>
            <div className='flex gap-2'>
              <button
                type='button'
                onClick={onClose}
                className='min-h-[44px] flex-1 rounded-xl border border-zinc-300 px-4 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={submit}
                disabled={sending}
                className='flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60'
              >
                {sending && <Spinner />}
                {sending ? 'Updating...' : 'Update password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordModal;
