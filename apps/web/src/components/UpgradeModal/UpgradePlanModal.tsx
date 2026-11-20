import React, { useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';

import { PaymentStep } from '@components/UpgradeModal/UpgradeModal';

export type PlanId = 'starter' | 'pro' | 'business';

interface PricingPlan {
  id: PlanId;
  name: string;
  price: string;
  period: string;
  icon: 'zap' | 'sparkle' | 'layers';
  description: string;
  features: string[];
  cta: string;
  popular?: boolean;
  disabled?: boolean;
}

const plans: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Go',
    price: 'PKR 299',
    period: '/week',
    icon: 'zap',
    description: 'For individuals and small teams getting started.',
    features: [
      'Priority agent routing',
      'Deep mode for complex tasks',
      'All Pro features for 7 days',
    ],
    cta: 'Subscribe',
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 'PKR 1,499',
    period: '/month',
    icon: 'sparkle',
    description: 'For growing teams that need smarter workflows.',
    features: [
      'Priority agent routing',
      'Deep mode for complex tasks',
      'Local payment methods',
    ],
    cta: 'Subscribe',
    popular: true,
  },
  {
    id: 'business',
    name: 'Team',
    price: 'PKR XXX',
    period: '',
    icon: 'layers',
    description: 'For large organizations with advanced needs.',
    features: [
      'Everything in Pro',
      'Hacker Lab',
      'Creative studio',
      'Priority support',
    ],
    cta: 'Subscribe',
    disabled: true,
  },
];

const Svg = ({ children, className = 'h-4 w-4', fill = 'none' }: { children: React.ReactNode; className?: string; fill?: string }) => (
  <svg
    viewBox='0 0 24 24'
    fill={fill}
    stroke={fill === 'none' ? 'currentColor' : 'none'}
    strokeWidth={2}
    strokeLinecap='round'
    strokeLinejoin='round'
    className={className}
    aria-hidden='true'
  >
    {children}
  </svg>
);

const CloseIcon = () => (
  <Svg className='h-4 w-4'>
    <path d='M18 6 6 18' />
    <path d='m6 6 12 12' />
  </Svg>
);

const CheckIcon = () => (
  <Svg className='h-4 w-4 flex-shrink-0 text-emerald-400'>
    <path d='M20 6 9 17l-5-5' />
  </Svg>
);

const BellIcon = ({ className = 'h-8 w-8 text-emerald-300 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]' }: { className?: string }) => (
  <Svg className={className}>
    <path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' />
    <path d='M10.3 21a1.94 1.94 0 0 0 3.4 0' />
  </Svg>
);

const SparkleIcon = ({ className = 'h-6 w-6' }: { className?: string }) => (
  <Svg className={className}>
    <path d='M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z' />
  </Svg>
);

const ZapIcon = () => (
  <Svg className='h-6 w-6'>
    <path d='M13 2 3 14h9l-1 8 10-12h-9l1-8z' />
  </Svg>
);

const LayersIcon = () => (
  <Svg className='h-6 w-6'>
    <path d='m12 2 10 5-10 5L2 7z' />
    <path d='m2 17 10 5 10-5' />
    <path d='m2 12 10 5 10-5' />
  </Svg>
);

const PlanIcon = ({ icon }: { icon: PricingPlan['icon'] }) => {
  if (icon === 'zap') return <ZapIcon />;
  if (icon === 'layers') return <LayersIcon />;
  return <SparkleIcon />;
};

const StarIcon = () => (
  <Svg className='h-3 w-3' fill='currentColor'>
    <path d='M12 2l2.9 6.9L22 10l-5.5 4.8L18.2 22 12 18.3 5.8 22l1.7-7.2L2 10l7.1-1.1z' />
  </Svg>
);

const PlanCard = ({ plan, onSelect }: { plan: PricingPlan; onSelect?: (id: PlanId) => void }) => {
  const highlighted = !!plan.popular;

  return (
    <div
      className={`relative flex flex-col rounded-2xl p-4 sm:p-5 ${
        highlighted
          ? 'border border-[rgb(158_255_0)] bg-zinc-50 shadow-[0_8px_30px_rgba(0,0,0,0.22)] dark:border-[rgb(158_255_0)] dark:bg-zinc-900/80 dark:shadow-[0_4px_20px_rgba(0,0,0,0.45),0_0_30px_rgba(0,0,0,0.3)]'
          : 'border border-zinc-200 bg-zinc-50 dark:border-zinc-800/80 dark:bg-zinc-900/80 dark:shadow-[0_4px_20px_rgba(0,0,0,0.45)]'
      }`}
    >
      {highlighted && (
        <span className='absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap bg-[rgb(158_255_0)] px-5 py-1.5 text-[11px] font-bold text-black [clip-path:polygon(10px_0,calc(100%-10px)_0,100%_50%,calc(100%-10px)_100%,10px_100%,0_50%)]'>
          <StarIcon />
          Most Popular
        </span>
      )}

      <div className='flex items-center gap-3'>
        <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#9EFF00] text-black shadow-[0_0_14px_rgba(158,255,0,0.35)]'>
          <PlanIcon icon={plan.icon} />
        </div>
        <h3 className='text-sm font-semibold tracking-widest text-zinc-900 dark:text-zinc-100'>{plan.name.toUpperCase()}</h3>
      </div>

      <p className='mt-3 min-h-[2.5rem] text-sm leading-relaxed text-zinc-600 dark:text-zinc-400'>{plan.description}</p>

      <div className='mt-3 flex items-baseline gap-1 border-b border-zinc-200 pb-3 dark:border-zinc-800'>
        <span className='text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50'>{plan.price}</span>
        <span className='text-sm text-zinc-500'>{plan.period}</span>
      </div>

      <p className='mt-4 text-[10px] font-semibold uppercase tracking-widest text-zinc-500'>What&apos;s included</p>
      <ul className='mt-2 flex flex-1 flex-col gap-1.5'>
        {plan.features.map((feature) => (
          <li key={feature} className='flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300'>
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      <button
        type='button'
        onClick={() => onSelect?.(plan.id)}
        disabled={plan.disabled}
        className='mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-zinc-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-black dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:hover:bg-white'
      >
        {plan.cta}
      </button>
    </div>
  );
};

const UpgradePlanModal = ({
  onClose,
  onSelectPlan,
}: {
  onClose: () => void;
  onSelectPlan?: (id: PlanId) => void;
}) => {
  const titleId = useId();
  const [selectedPlan, setSelectedPlan] = useState<PricingPlan | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className='fixed inset-0 z-[1000] flex overflow-y-auto bg-black/80 p-4 backdrop-blur-md'
      onMouseDown={onClose}
    >
      <div
        role='dialog'
        aria-modal='true'
        aria-labelledby={titleId}
        onMouseDown={(e) => e.stopPropagation()}
        className={`relative m-auto w-full rounded-3xl border border-zinc-200 bg-white p-4 text-zinc-900 shadow-2xl backdrop-blur-xl transition-[max-width] duration-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 [scrollbar-width:none] sm:p-5 [&::-webkit-scrollbar]:hidden ${
          selectedPlan ? 'max-w-4xl' : 'max-w-5xl'
        }`}
      >
        <div className='relative flex min-h-[11.25rem] flex-col justify-center overflow-hidden rounded-2xl px-4 py-4 sm:px-5'>
          <img
            src='/assets/bg-upgrade.jpeg'
            alt=''
            aria-hidden='true'
            className='absolute inset-0 h-full w-full object-cover object-[70%_40%]'
          />
          <div className='relative pl-[34px] pr-12 sm:pl-[42px]'>
            <h2 id={titleId} className='text-[23px] font-bold text-white'>
              Upgrade Plan
            </h2>
            <p className='mt-1 text-[16px] text-zinc-300'>Choose the plan that works best for your team.</p>
          </div>

          <button
            type='button'
            onClick={onClose}
            aria-label='Close upgrade plans'
            className='absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-zinc-100 text-zinc-600 transition-all hover:bg-zinc-200 hover:text-zinc-900 dark:border-zinc-700/50 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white'
          >
            <CloseIcon />
          </button>
        </div>

        {selectedPlan ? (
          <div className='px-2 pb-2 pt-4 sm:px-6 sm:pb-4'>
            <PaymentStep plan={selectedPlan.name} onBack={() => setSelectedPlan(null)} />
          </div>
        ) : (
          <div className='grid grid-cols-1 gap-4 pt-4 md:grid-cols-3'>
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onSelect={(id) => {
                  onSelectPlan?.(id);
                  setSelectedPlan(plan);
                }}
              />
            ))}
          </div>
        )}

      </div>
    </div>,
    document.body,
  );
};

export default UpgradePlanModal;
