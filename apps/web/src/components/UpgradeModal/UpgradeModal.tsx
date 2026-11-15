import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import CrossIcon2 from '@icon/CrossIcon2';
import { validateCoupon } from '@api/api';

// Manual beta billing: buyer scans the NayaPay QR, pays, then sends proof.
// The plan is set manually after the payment is confirmed.
const NAYAPAY_ACCOUNT_ID = 'Pico — NayaPay';
const SUPPORT_EMAIL = 'support@askpico.app';

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'For trying out Pico.',
    features: ['Limited daily messages', 'Standard models', 'Chat history'],
    cta: 'Current Plan',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$20',
    period: 'per month',
    description: 'For everyday power users.',
    features: [
      'Unlimited messages',
      'All models, including GPT-4',
      'Priority responses',
      'Export and share chats',
    ],
    cta: 'Upgrade Now',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'per team',
    description: 'For teams with security needs.',
    features: [
      'Everything in Pro',
      'Team management',
      'SSO and admin controls',
      'Dedicated support',
    ],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

const UpgradeModal = ({ onClose }: { onClose: () => void }) => {
  const [step, setStep] = useState<'plans' | 'payment'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<string>('Pro');

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (step === 'payment') setStep('plans');
        else onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, step]);

  const openPayment = (planName: string) => {
    setSelectedPlan(planName);
    setStep('payment');
  };

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-md'
      onMouseDown={onClose}
    >
      <div
        className='relative mx-auto w-[95vw] max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-zinc-200 bg-white p-4 backdrop-blur-2xl dark:border-zinc-800 dark:bg-zinc-950 sm:max-w-3xl sm:p-6 shadow-2xl'
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          className='absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-ink/5 hover:text-ink'
          onClick={onClose}
          aria-label='close upgrade plans'
        >
          <CrossIcon2 />
        </button>

        {step === 'payment' ? (
          <PaymentStep
            plan={selectedPlan}
            onBack={() => setStep('plans')}
          />
        ) : (
          <>
        <div className='text-center'>
          <h2 className='text-xl font-semibold text-ink'>Upgrade Your Plan</h2>
          <p className='mt-1 text-sm text-ink-muted'>
            Choose the plan that fits how you work.
          </p>
        </div>

        <div className='mt-6 grid grid-cols-1 gap-4 md:grid-cols-3'>
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border p-5 ${
                plan.highlighted
                  ? 'border-brand-300 bg-brand-50 shadow-card'
                  : 'border-surface-line bg-surface'
              }`}
            >
              <div className='text-sm font-semibold text-ink'>{plan.name}</div>
              <div className='mt-1 text-xs text-ink-muted'>
                {plan.description}
              </div>
              <div className='mt-4 flex items-baseline gap-1'>
                <span className='text-2xl font-semibold text-ink'>
                  {plan.price}
                </span>
                <span className='text-xs text-ink-muted'>{plan.period}</span>
              </div>
              <ul className='mt-4 flex flex-1 flex-col gap-2 text-sm text-ink-soft'>
                {plan.features.map((f) => (
                  <li key={f} className='flex items-start gap-2'>
                    <span className='mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-brand-500' />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                className={`mt-5 w-full rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                  plan.cta === 'Current Plan'
                    ? 'border border-surface-line bg-surface text-ink-muted'
                    : plan.highlighted
                    ? 'bg-ink text-surface hover:bg-ink-soft'
                    : 'border border-surface-line bg-surface text-ink hover:bg-surface-muted'
                }`}
                disabled={plan.cta === 'Current Plan'}
                onClick={() => {
                  if (plan.cta === 'Upgrade Now') openPayment(plan.name);
                  else if (plan.cta === 'Contact Sales')
                    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=Pico Enterprise`;
                }}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

// Placeholder QR — replace this component's markup (or drop in an <img>) with
// the real NayaPay QR before launch.
const NayaPayQr = () => (
  <svg viewBox='0 0 200 200' role='img' aria-label='NayaPay payment QR code' className='h-full w-full'>
    <rect width='200' height='200' rx='12' fill='#ffffff' />
    <rect x='10' y='10' width='180' height='180' rx='10' fill='none' stroke='#7c5ce0' strokeWidth='2' strokeDasharray='8 6' />
    <g fill='#7c5ce0' opacity='0.9'>
      <rect x='28' y='28' width='42' height='42' rx='6' fill='none' stroke='#7c5ce0' strokeWidth='6' />
      <rect x='130' y='28' width='42' height='42' rx='6' fill='none' stroke='#7c5ce0' strokeWidth='6' />
      <rect x='28' y='130' width='42' height='42' rx='6' fill='none' stroke='#7c5ce0' strokeWidth='6' />
      <rect x='42' y='42' width='14' height='14' rx='2' />
      <rect x='144' y='42' width='14' height='14' rx='2' />
      <rect x='42' y='144' width='14' height='14' rx='2' />
    </g>
    <g fill='#a58ef0'>
      <rect x='90' y='30' width='8' height='8' rx='1' />
      <rect x='106' y='46' width='8' height='8' rx='1' />
      <rect x='90' y='62' width='8' height='8' rx='1' />
      <rect x='30' y='90' width='8' height='8' rx='1' />
      <rect x='46' y='106' width='8' height='8' rx='1' />
      <rect x='62' y='90' width='8' height='8' rx='1' />
      <rect x='90' y='90' width='8' height='8' rx='1' />
      <rect x='106' y='106' width='8' height='8' rx='1' />
      <rect x='130' y='90' width='8' height='8' rx='1' />
      <rect x='154' y='98' width='8' height='8' rx='1' />
      <rect x='90' y='130' width='8' height='8' rx='1' />
      <rect x='106' y='146' width='8' height='8' rx='1' />
      <rect x='130' y='130' width='8' height='8' rx='1' />
      <rect x='146' y='146' width='8' height='8' rx='1' />
      <rect x='162' y='130' width='8' height='8' rx='1' />
      <rect x='130' y='162' width='8' height='8' rx='1' />
      <rect x='162' y='162' width='8' height='8' rx='1' />
      <rect x='90' y='162' width='8' height='8' rx='1' />
    </g>
    <text x='100' y='104' textAnchor='middle' fontFamily='system-ui, sans-serif' fontSize='11' fontWeight='600' fill='#7c5ce0'>
      NayaPay QR
    </text>
    <text x='100' y='118' textAnchor='middle' fontFamily='system-ui, sans-serif' fontSize='8' fill='#9aa0aa'>
      replace with real QR
    </text>
  </svg>
);

export const PaymentStep = ({
  plan,
  onBack,
}: {
  plan: string;
  onBack: () => void;
}) => {
  const [coupon, setCoupon] = useState('');
  const [couponState, setCouponState] = useState<{
    checking: boolean;
    message: string | null;
    valid: boolean;
  }>({ checking: false, message: null, valid: false });
  const [trxId, setTrxId] = useState('');

  const applyCoupon = async () => {
    const code = coupon.trim();
    if (!code || couponState.checking) return;
    setCouponState({ checking: true, message: null, valid: false });
    try {
      const result = await validateCoupon(code);
      if (result.status === 'valid') {
        setCouponState({
          checking: false,
          valid: true,
          message: `Code applied — ${result.discountPct}% off your first ${result.months} months. Include "${code.toUpperCase()}" with your payment proof.`,
        });
      } else {
        const labels = {
          invalid: 'This code is not valid.',
          expired: 'This code has expired.',
          used: 'This code has already been used.',
        } as const;
        setCouponState({
          checking: false,
          valid: false,
          message: labels[result.status] ?? 'This code is not valid.',
        });
      }
    } catch {
      setCouponState({
        checking: false,
        valid: false,
        message: 'Could not check the code right now. You can still include it with your payment proof.',
      });
    }
  };

  return (
  <div className='flex flex-col items-center'>
    <button
      type='button'
      onClick={onBack}
      className='mb-4 self-start text-sm font-medium text-ink-soft transition-colors hover:text-ink'
    >
      ← Back to plans
    </button>

    <div className='grid w-full items-start gap-6 md:grid-cols-2'>
    <div className='flex flex-col items-center'>
    <div className='text-center'>
      <h2 className='text-xl font-semibold text-ink'>Pay for {plan}</h2>
      <p className='mt-1 text-sm text-ink-muted'>
        Scan the QR with NayaPay
      </p>
    </div>

    <div className='mt-5 h-48 w-48 rounded-2xl border border-surface-line'>
      <NayaPayQr />
    </div>
    </div>

    <div className='flex w-full flex-col'>
    <ol className='flex w-full flex-col gap-2 text-sm text-ink-soft'>
      <li className='flex gap-2 break-words'>
        <span className='shrink-0 font-semibold text-brand-600'>1.</span>
        Open the NayaPay app and scan the QR code above.
      </li>
      <li className='flex gap-2 break-words'>
        <span className='shrink-0 font-semibold text-brand-600'>2.</span>
        Complete the payment for the {plan} plan.
      </li>
      <li className='flex gap-2 break-words'>
        <span className='shrink-0 font-semibold text-brand-600'>3.</span>
        <span className='min-w-0'>
          {'Send a screenshot with the transaction reference to '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className='whitespace-nowrap font-medium text-brand-600 hover:underline'
          >
            {SUPPORT_EMAIL}
          </a>
          {' or message Pico support in-app.'}
        </span>
      </li>
      <li className='flex gap-2 break-words'>
        <span className='shrink-0 font-semibold text-brand-600'>4.</span>
        Your plan is activated manually after payment is confirmed. During beta
        this can take up to 24 hours.
      </li>
    </ol>

    <div className='mt-4 w-full'>
      <label htmlFor='payment-trx-id' className='mb-1 block text-xs font-medium text-ink-soft'>
        Transaction reference <span className='text-red-500'>*</span>
      </label>
      <input
        id='payment-trx-id'
        type='text'
        required
        aria-required='true'
        value={trxId}
        onChange={(e) => setTrxId(e.target.value)}
        placeholder='e.g. TRX123456'
        className='w-full rounded-2xl border border-surface-line bg-surface-muted/50 py-3 px-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-brand-500 focus:bg-surface'
        maxLength={64}
      />
    </div>

    <div className='mt-3 w-full'>
      <div className='relative'>
        <input
          type='text'
          value={coupon}
          onChange={(e) => setCoupon(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void applyCoupon();
          }}
          placeholder='Early-buyer code (e.g. EARLY-01)'
          className='w-full rounded-2xl border border-surface-line bg-surface-muted/50 py-3 pl-4 pr-12 text-sm uppercase tracking-wide text-ink outline-none transition-colors placeholder:normal-case placeholder:tracking-normal focus:border-brand-500 focus:bg-surface'
          maxLength={32}
        />
        <button
          type='button'
          onClick={() => void applyCoupon()}
          disabled={coupon.trim() === '' || couponState.checking}
          aria-label={couponState.checking ? 'Checking code' : 'Apply coupon'}
          className='absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-ink text-surface transition-colors hover:bg-ink-soft disabled:opacity-40'
        >
          {couponState.checking ? (
            <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white' />
          ) : (
            <svg
              viewBox='0 0 24 24'
              fill='none'
              stroke='currentColor'
              strokeWidth='2.5'
              strokeLinecap='round'
              strokeLinejoin='round'
              className='h-4 w-4'
            >
              <path d='M5 12h14' />
              <path d='m12 5 7 7-7 7' />
            </svg>
          )}
        </button>
      </div>
      {couponState.message && (
        <p
          className={`mt-2 break-words rounded-lg px-3 py-1.5 text-xs ${
            couponState.valid
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-surface-muted text-ink-muted'
          }`}
        >
          {couponState.message}
        </p>
      )}
      <p className='mt-2 text-xs text-ink-muted'>
        Early-buyer codes give 50% off the first 3 months of Pro Monthly.
      </p>
    </div>
    </div>
    </div>
  </div>
  );
};

export default UpgradeModal;
