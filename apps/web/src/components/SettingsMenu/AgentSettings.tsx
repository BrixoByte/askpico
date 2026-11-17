import React, { useEffect, useState } from 'react';
import FocusApps from './FocusApps';
import {
  type AgentFeature,
  hasCapability,
  requestAccess,
  vaultSet,
} from '@utils/nativeAgent';

const CAPABILITIES: { id: AgentFeature; label: string; help: string }[] = [
  { id: 'usage', label: 'Usage access', help: 'Lets the shield detect which app is open.' },
  { id: 'overlay', label: 'Display over other apps', help: 'Lets the shield cover blocked apps.' },
  { id: 'microphone', label: 'Microphone', help: 'Lets Pico hear your voice.' },
];

const VAULT_KINDS = ['contact', 'note', 'credential'] as const;
type VaultKind = (typeof VAULT_KINDS)[number];

const VAULT_REFS_KEY = 'pico-vault-refs';

interface VaultRef {
  id: string;
  label: string;
}

const readVaultRefs = (): VaultRef[] => {
  try {
    const raw = localStorage.getItem(VAULT_REFS_KEY);
    return raw ? (JSON.parse(raw) as VaultRef[]) : [];
  } catch {
    return [];
  }
};

const randomRef = (): string => {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

export const AgentSettings = () => {
  const [, setRefreshTick] = useState(0);
  const [vaultKind, setVaultKind] = useState<VaultKind>('contact');
  const [vaultLabel, setVaultLabel] = useState('');
  const [vaultValue, setVaultValue] = useState('');
  const [vaultRefs, setVaultRefs] = useState<VaultRef[]>(readVaultRefs);
  const [vaultError, setVaultError] = useState<string | null>(null);

  useEffect(() => {
    const onFocus = () => setRefreshTick((n) => n + 1);
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const saveVault = () => {
    const label = vaultLabel.trim();
    if (label === '' || vaultValue === '') {
      setVaultError('Add a label and a value.');
      return;
    }
    const ref = `${vaultKind}:ref_${randomRef()}`;
    if (!vaultSet(ref, vaultValue)) {
      setVaultError('Value could not be saved on this device.');
      return;
    }
    const next = [...vaultRefs, { id: ref, label }];
    localStorage.setItem(VAULT_REFS_KEY, JSON.stringify(next));
    setVaultRefs(next);
    setVaultLabel('');
    setVaultValue('');
    setVaultError(null);
  };

  const removeVaultRef = (id: string) => {
    const next = vaultRefs.filter((r) => r.id !== id);
    localStorage.setItem(VAULT_REFS_KEY, JSON.stringify(next));
    setVaultRefs(next);
  };

  return (
    <div className='flex flex-col gap-6'>
      <FocusApps />
      <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
        <h4 className='text-sm font-semibold text-gray-900 dark:text-white'>Permissions</h4>
        <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
          Pico asks for each permission only when you turn a feature on.
        </p>
        <ul className='mt-3 flex flex-col divide-y divide-gray-100 dark:divide-zinc-800'>
          {CAPABILITIES.map((cap) => {
            const granted = hasCapability(cap.id);
            return (
              <li key={cap.id} className='flex items-center justify-between gap-3 py-2'>
                <div>
                  <p className='text-sm text-gray-800 dark:text-zinc-200'>{cap.label}</p>
                  <p className='text-xs text-gray-500 dark:text-zinc-400'>{cap.help}</p>
                </div>
                {granted ? (
                  <span className='text-xs font-medium text-emerald-600 dark:text-[#9EFF00]'>Granted</span>
                ) : (
                  <button
                    type='button'
                    onClick={() => requestAccess(cap.id)}
                    className='relative rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 after:absolute after:-inset-2 after:content-[""] dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  >
                    Grant
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h4 className='text-sm font-semibold text-gray-900 dark:text-white'>Private details</h4>
        <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
          Stored encrypted on this device only. Pico never shows these values back, and the AI never sees them.
        </p>
        <div className='mt-3 flex flex-col gap-2'>
          <div className='flex gap-2'>
            <select
              value={vaultKind}
              onChange={(e) => setVaultKind(e.target.value as VaultKind)}
              className='min-h-[48px] rounded-lg border border-gray-300 bg-surface px-2 py-2 text-sm text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
            >
              {VAULT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <input
              type='text'
              value={vaultLabel}
              maxLength={40}
              onChange={(e) => setVaultLabel(e.target.value)}
              placeholder='Label, e.g. Mom'
              className='min-h-[48px] flex-1 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
            />
          </div>
          <div className='flex gap-2'>
            <input
              type='password'
              autoComplete='off'
              value={vaultValue}
              maxLength={4000}
              onChange={(e) => setVaultValue(e.target.value)}
              placeholder='Value (hidden)'
              className='min-h-[48px] flex-1 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
            />
            <button
              type='button'
              onClick={saveVault}
              className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700'
            >
              Save
            </button>
          </div>
          {vaultError && <p className='text-xs text-red-500'>{vaultError}</p>}
        </div>
        <ul className='mt-3 flex flex-col divide-y divide-gray-100 dark:divide-zinc-800'>
          {vaultRefs.map((ref) => (
            <li key={ref.id} className='flex items-center justify-between gap-3 py-2'>
              <span className='text-sm text-gray-700 dark:text-zinc-300'>
                {ref.label} <span className='text-xs text-gray-400'>••••••</span>
              </span>
              <button
                type='button'
                onClick={() => removeVaultRef(ref.id)}
                className='relative shrink-0 text-xs text-gray-400 transition-colors hover:text-red-500 after:absolute after:-inset-3 after:content-[""]'
              >
                Remove
              </button>
            </li>
          ))}
          {vaultRefs.length === 0 && (
            <li className='py-3 text-xs text-gray-400 dark:text-zinc-500'>No private details saved.</li>
          )}
        </ul>
      </div>
    </div>
  );
};

export default AgentSettings;
