import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@api/supabase';
import { resetRedirectUrl } from '@utils/authRoutes';

export type AuthMode = 'signin' | 'signup';

const emailField = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address');

const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must include a letter')
  .regex(/\d/, 'Password must include a number');

const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Password is required'),
});

const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Name is required')
      .max(60, 'Name must be 60 characters or fewer'),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type SignInValues = z.infer<typeof signInSchema>;
type SignUpValues = z.infer<typeof signUpSchema>;

const NOT_CONFIGURED = 'Sign-in is not available right now. Please try again later.';

const friendlyError = (message: string): string => {
  const text = message.toLowerCase();
  if (text.includes('invalid login credentials')) return 'Email or password is incorrect.';
  if (text.includes('already registered') || text.includes('already been registered'))
    return 'An account with this email already exists. Sign in instead.';
  if (text.includes('email not confirmed'))
    return 'Please confirm your email first. Check your inbox for the link.';
  if (text.includes('user not found')) return 'No account was found with this email.';
  if (text.includes('rate limit') || text.includes('too many'))
    return 'Too many attempts. Please wait a minute and try again.';
  return message;
};

const inputClass = (hasError: boolean) =>
  `mobile-auth-input min-h-[48px] w-full rounded-xl border bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 placeholder-zinc-400 transition-colors focus:outline-none dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder-zinc-600 ${
    hasError
      ? 'border-red-500/60 focus:border-red-500'
      : 'border-zinc-300 focus:border-brand-500 dark:border-zinc-800'
  }`;

const Spinner = () => (
  <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white' aria-hidden='true' />
);

const EyeIcon = ({ off }: { off: boolean }) => (
  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4' aria-hidden='true'>
    <path d='M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z' />
    <circle cx='12' cy='12' r='3' />
    {off && <path d='M3 3l18 18' />}
  </svg>
);

const PasswordInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { hasError?: boolean }>(
  ({ hasError = false, ...props }, ref) => {
    const [visible, setVisible] = useState(false);
    return (
      <div className='relative'>
        <input
          ref={ref}
          {...props}
          type={visible ? 'text' : 'password'}
          className={`${inputClass(hasError)} pr-10`}
        />
        <button
          type='button'
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className='absolute inset-y-0 right-0 flex min-w-[48px] items-center justify-center px-3 text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-200'
        >
          <EyeIcon off={visible} />
        </button>
      </div>
    );
  }
);
PasswordInput.displayName = 'PasswordInput';

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className='mt-1 text-xs text-red-500 dark:text-red-400'>{message}</p> : null;

const Banner = ({ tone, children }: { tone: 'error' | 'info'; children: React.ReactNode }) => (
  <div
    role={tone === 'error' ? 'alert' : 'status'}
    className={`rounded-xl border px-3.5 py-2.5 text-sm ${
      tone === 'error'
        ? 'border-red-200 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
        : 'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
    }`}
  >
    {children}
  </div>
);

interface FormProps {
  onSignedIn: (session?: Session | null) => void;
}

const RESET_COOLDOWN_MS = 45_000;

const SignInForm = ({ onSignedIn }: FormProps) => {
  const [formError, setFormError] = useState<string | null>(null);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetInfo, setResetInfo] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  });
  const signInEmail = watch('email');

  const onSubmit = async (values: SignInValues) => {
    setFormError(null);
    if (!supabase) return setFormError(NOT_CONFIGURED);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) return setFormError(friendlyError(error.message));
    onSignedIn(data.session);
  };

  const openReset = () => {
    setResetEmail(signInEmail?.includes('@') ? signInEmail : '');
    setResetInfo(null);
    setResetError(null);
    setShowReset(true);
  };

  const sendReset = async () => {
    setResetError(null);
    setResetInfo(null);
    const email = resetEmail.trim();
    if (!emailField.safeParse(email).success) {
      return setResetError('Enter a valid email address.');
    }
    if (!supabase) return setResetError(NOT_CONFIGURED);
    if (Date.now() < cooldownUntil) {
      return setResetError('Please wait a moment before requesting another link.');
    }
    setResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: resetRedirectUrl(),
      });
      if (error) {
        const text = error.message.toLowerCase();
        if (text.includes('rate limit') || text.includes('too many') || text.includes('email rate limit')) {
          setCooldownUntil(Date.now() + RESET_COOLDOWN_MS);
          return setResetError('Too many attempts. Please wait a minute and try again.');
        }
        return setResetError('Could not send the reset link. Check your connection and try again.');
      }
      setCooldownUntil(Date.now() + RESET_COOLDOWN_MS);
      // Generic on purpose: never reveal whether the email exists.
      setResetInfo('If an account exists for this email, we sent a password reset link.');
    } catch {
      setResetError('Could not send the reset link. Check your connection and try again.');
    } finally {
      setResetSending(false);
    }
  };

  if (showReset) {
    return (
      <div className='flex flex-col gap-4'>
        {resetError && <Banner tone='error'>{resetError}</Banner>}
        {resetInfo && <Banner tone='info'>{resetInfo}</Banner>}
        <div>
          <label htmlFor='auth-reset-email' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
            Email
          </label>
          <input
            id='auth-reset-email'
            type='email'
            autoComplete='email'
            placeholder='you@example.com'
            value={resetEmail}
            onChange={(e) => setResetEmail(e.target.value)}
            className={inputClass(false)}
          />
        </div>
        <button
          type='button'
          onClick={sendReset}
          disabled={resetSending || Date.now() < cooldownUntil}
          className="relative flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 after:absolute after:-inset-y-1 after:content-['']  text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetSending && <Spinner />}
          {resetSending ? 'Sending...' : 'Send reset link'}
        </button>
        <button
          type='button'
          onClick={() => setShowReset(false)}
          className='text-xs text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400'
        >
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className='flex flex-col gap-4'>
      {formError && <Banner tone='error'>{formError}</Banner>}
      <div>
        <label htmlFor='auth-signin-email' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Email
        </label>
        <input
          id='auth-signin-email'
          type='email'
          autoComplete='email'
          placeholder='you@example.com'
          aria-invalid={!!errors.email}
          className={inputClass(!!errors.email)}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <label htmlFor='auth-signin-password' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Password
        </label>
        <PasswordInput
          id='auth-signin-password'
          autoComplete='current-password'
          placeholder='Your password'
          aria-invalid={!!errors.password}
          hasError={!!errors.password}
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div className='flex items-center justify-between text-xs'>
        <label className="relative flex cursor-pointer items-center gap-2 text-zinc-600 dark:text-zinc-400 after:absolute after:-inset-y-[17px] after:content-['']">
          <input type='checkbox' aria-label='Remember me' className='h-3.5 w-3.5 rounded border-zinc-300 dark:border-zinc-700' />
          Remember me
        </label>
        <button type='button' onClick={openReset} className="relative text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400 after:absolute after:-inset-y-3 after:-inset-x-2 after:content-['']">
          Forgot Password
        </button>
      </div>
      <button
        type='submit'
        disabled={isSubmitting}
        className="relative flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 after:absolute after:-inset-y-1 after:content-['']  text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <Spinner />}
        {isSubmitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
};

const SignUpForm = ({ onSignedIn, wide = false }: FormProps & { wide?: boolean }) => {
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    setInfo(null);
    if (!supabase) return setFormError(NOT_CONFIGURED);
    const name = values.name?.trim();
    const { data: current } = await supabase.auth.getSession();
    if (current.session?.user.is_anonymous) {
      const { error: upgradeError } = await supabase.auth.updateUser({
        email: values.email,
        password: values.password,
        data: name ? { name } : undefined,
      });
      if (upgradeError) return setFormError(friendlyError(upgradeError.message));
      const { data: upgraded } = await supabase.auth.getSession();
      if (upgraded.session && !upgraded.session.user.is_anonymous) return onSignedIn(upgraded.session);
      return setInfo('Account created. Check your email to confirm it, then sign in.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: name ? { data: { name } } : undefined,
    });
    if (error) return setFormError(friendlyError(error.message));
    // With email confirmation on, Supabase returns an empty identities list for
    // an existing address instead of an error, so this check is needed.
    if (data.user && data.user.identities?.length === 0) {
      return setFormError(friendlyError('already registered'));
    }
    if (data.session) return onSignedIn(data.session);
    setInfo('Account created. Check your email to confirm it, then sign in.');
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className='flex flex-col gap-4'>
      {formError && <Banner tone='error'>{formError}</Banner>}
      {info && <Banner tone='info'>{info}</Banner>}
      <div className={wide ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : 'flex flex-col gap-4'}>
      <div>
        <label htmlFor='auth-signup-name' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Name
        </label>
        <input
          id='auth-signup-name'
          type='text'
          autoComplete='name'
          placeholder='Your name'
          aria-invalid={!!errors.name}
          className={inputClass(!!errors.name)}
          {...register('name')}
        />
        <FieldError message={errors.name?.message} />
      </div>
      <div>
        <label htmlFor='auth-signup-email' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Email
        </label>
        <input
          id='auth-signup-email'
          type='email'
          autoComplete='email'
          placeholder='you@example.com'
          aria-invalid={!!errors.email}
          className={inputClass(!!errors.email)}
          {...register('email')}
        />
        <FieldError message={errors.email?.message} />
      </div>
      <div>
        <label htmlFor='auth-signup-password' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Password
        </label>
        <PasswordInput
          id='auth-signup-password'
          autoComplete='new-password'
          placeholder='At least 8 characters'
          aria-invalid={!!errors.password}
          hasError={!!errors.password}
          {...register('password')}
        />
        <FieldError message={errors.password?.message} />
      </div>
      <div>
        <label htmlFor='auth-signup-confirm' className='mb-1 block text-xs font-medium text-zinc-700 dark:text-zinc-300'>
          Confirm password
        </label>
        <PasswordInput
          id='auth-signup-confirm'
          autoComplete='new-password'
          placeholder='Re-enter your password'
          aria-invalid={!!errors.confirmPassword}
          hasError={!!errors.confirmPassword}
          {...register('confirmPassword')}
        />
        <FieldError message={errors.confirmPassword?.message} />
      </div>
      </div>
      <button
        type='submit'
        disabled={isSubmitting}
        className="relative flex items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 after:absolute after:-inset-y-1 after:content-['']  text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting && <Spinner />}
        {isSubmitting ? 'Creating account...' : 'Create account'}
      </button>
    </form>
  );
};

interface AuthModalProps {
  onClose?: () => void;
  onSignedIn: (session?: Session | null) => void;
  // Embedded renders the card inline, used by the standalone auth page.
  embedded?: boolean;
  mode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
}

const AuthModal = ({ onClose, onSignedIn, embedded = false, mode: modeProp, onModeChange }: AuthModalProps) => {
  const [internalMode, setInternalMode] = useState<AuthMode>('signin');
  const mode = modeProp ?? internalMode;
  const setMode = onModeChange ?? setInternalMode;

  if (embedded) {
    return (
      <div className={`w-full ${mode === 'signup' ? 'max-w-md' : 'max-w-sm'}`}>
        {mode === 'signin' ? (
          <SignInForm key='signin' onSignedIn={onSignedIn} />
        ) : (
          <SignUpForm key='signup' onSignedIn={onSignedIn} wide />
        )}
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
      active
        ? 'bg-white text-zinc-900 shadow-sm dark:bg-white/10 dark:text-white'
        : 'text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200'
    }`;

  const card = (
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby='auth-modal-title'
        className='relative w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-6 shadow-card dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.6)] dark:ring-1 dark:ring-white/5'
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
        <button
          type='button'
          onClick={onClose}
          aria-label='Close'
          className='absolute right-3 top-3 rounded-lg p-1.5 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-600 dark:text-zinc-500 dark:hover:bg-white/5 dark:hover:text-zinc-200'
        >
          <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' className='h-4 w-4' aria-hidden='true'>
            <path d='M18 6L6 18M6 6l12 12' />
          </svg>
        </button>
        )}

        <div className='mb-6 flex flex-col items-center text-center'>
          <div className='relative mb-3 flex items-center justify-center'>
            <div className='absolute h-24 w-24 rounded-full bg-purple-500/20 blur-2xl' />
            <img src='/assets/brand/logo.png' alt='Pico' className='relative h-20 w-20 object-contain' />
          </div>
          <h2 id='auth-modal-title' className='text-lg font-semibold text-zinc-900 dark:text-zinc-100'>
            {mode === 'signin' ? 'Welcome back' : 'Create your Pico account'}
          </h2>
          <p className='mt-1 text-xs text-zinc-500 dark:text-zinc-400'>
            {mode === 'signin'
              ? 'Sign in to keep your chats and memory across devices.'
              : 'Save your chats and memory across devices.'}
          </p>
        </div>

        <div role='tablist' className='mb-5 flex gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-800'>
          <button
            type='button'
            role='tab'
            aria-selected={mode === 'signin'}
            className={tabClass(mode === 'signin')}
            onClick={() => setMode('signin')}
          >
            Sign In
          </button>
          <button
            type='button'
            role='tab'
            aria-selected={mode === 'signup'}
            className={tabClass(mode === 'signup')}
            onClick={() => setMode('signup')}
          >
            Create Account
          </button>
        </div>

        {mode === 'signin' ? (
          <SignInForm key='signin' onSignedIn={onSignedIn} />
        ) : (
          <SignUpForm key='signup' onSignedIn={onSignedIn} />
        )}
      </div>
  );

  return (
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm'
      onClick={onClose}
    >
      {card}
    </div>
  );
};

export default AuthModal;
