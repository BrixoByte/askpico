import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type FocusOutcome,
  type FocusStatus,
  type FocusStrength,
  type LaunchableApp,
  focusBeginWait,
  focusEarlyUnblock,
  focusEmergency,
  focusRecover,
  focusSetEnabled,
  focusSetupPasscode,
  focusStart,
  focusStatus,
  hasCapability,
  listLaunchableApps,
  openAppSettings,
  requestAccess,
} from '@utils/nativeAgent';

const PICKED_KEY = 'pico-focus-picked';
const WAIT_MS = 60_000;
const PRESETS: { ms: number; label: string }[] = [
  { ms: 60 * 60 * 1000, label: '1 hour' },
  { ms: 24 * 60 * 60 * 1000, label: '1 day' },
  { ms: 7 * 24 * 60 * 60 * 1000, label: '1 week' },
];
const STRENGTHS: { id: FocusStrength; label: string; help: string }[] = [
  { id: 'STRICT', label: 'Strict', help: '1 early unblock, 60-second wait' },
  { id: 'BALANCED', label: 'Balanced', help: '2 early unblocks, no wait' },
  { id: 'LIGHT', label: 'Light', help: '5 early unblocks, no wait' },
];

const readPicked = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(PICKED_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

const outcomeText = (o: FocusOutcome): string => {
  switch (o) {
    case 'OK':
      return 'Done.';
    case 'WRONG_PASSCODE':
      return 'Wrong passcode.';
    case 'LOCKED':
      return 'Too many wrong tries. Wait for the cool-down, then try again.';
    case 'NO_UNBLOCKS':
      return 'No early unblocks left for this session.';
    case 'WAIT_REQUIRED':
      return 'Wait for the full 60 seconds first.';
    case 'NO_PASSCODE':
      return 'Set a passcode first.';
    default:
      return 'No active session.';
  }
};

const permissionsMissing = (): boolean => !hasCapability('usage') || !hasCapability('overlay');

export const FocusApps = () => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<FocusStatus>(focusStatus);
  const [needsPermissions, setNeedsPermissions] = useState(permissionsMissing);
  const [showDisclosure, setShowDisclosure] = useState(false);
  const [apps, setApps] = useState<LaunchableApp[]>([]);
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>(readPicked);
  const [preset, setPreset] = useState(PRESETS[0].ms);
  const [strength, setStrength] = useState<FocusStrength>('BALANCED');
  const [newPasscode, setNewPasscode] = useState('');
  const [confirmPasscode, setConfirmPasscode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [recoveryAck, setRecoveryAck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [unblockWarning, setUnblockWarning] = useState(false);
  const [gate, setGate] = useState<null | { kind: 'early' | 'emergency'; readyAt: number }>(null);
  const [now, setNow] = useState(Date.now());
  const [actionPasscode, setActionPasscode] = useState('');
  const [recoveryInput, setRecoveryInput] = useState('');
  const [recoveryNew, setRecoveryNew] = useState('');
  const [showRecovery, setShowRecovery] = useState(false);

  const refresh = () => {
    setStatus(focusStatus());
    setNeedsPermissions(permissionsMissing());
  };

  useEffect(() => {
    setApps(listLaunchableApps());
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? apps.filter((a) => a.label.toLowerCase().includes(q)) : apps;
  }, [apps, search]);

  const togglePick = (pkg: string) => {
    const next = picked.includes(pkg) ? picked.filter((p) => p !== pkg) : [...picked, pkg];
    setPicked(next);
    localStorage.setItem(PICKED_KEY, JSON.stringify(next));
  };

  const turnOn = () => {
    focusSetEnabled(true);
    setShowDisclosure(false);
    refresh();
  };

  const startSession = () => {
    setMessage(null);
    if (picked.length === 0) {
      setMessage('Choose at least one app first.');
      return;
    }
    if (!status.hasPasscode) {
      if (newPasscode.length < 4 || newPasscode !== confirmPasscode) {
        setMessage('Passcode must be at least 4 characters, and both entries must match.');
        return;
      }
      const code = focusSetupPasscode(newPasscode);
      if (!code) {
        setMessage('Could not set the passcode.');
        return;
      }
      setRecoveryCode(code);
    }
    if (focusStart(preset, strength, picked)) {
      setNewPasscode('');
      setConfirmPasscode('');
      refresh();
    } else {
      setMessage('Could not start the session.');
    }
  };

  const requestGatedAction = (kind: 'early' | 'emergency', waitMs: number) => {
    setMessage(null);
    if (waitMs > 0) {
      focusBeginWait();
      setGate({ kind, readyAt: Date.now() + waitMs });
    } else {
      setGate({ kind, readyAt: Date.now() });
    }
  };

  const submitAction = () => {
    if (!gate) return;
    const outcome = gate.kind === 'early' ? focusEarlyUnblock(actionPasscode) : focusEmergency(actionPasscode);
    setActionPasscode('');
    setGate(null);
    setMessage(outcomeText(outcome));
    refresh();
  };

  const submitRecovery = () => {
    const ok = focusRecover(recoveryInput, recoveryNew);
    setMessage(ok ? 'Passcode reset.' : 'Recovery code did not match, or the new passcode is too short.');
    if (ok) {
      setRecoveryInput('');
      setRecoveryNew('');
      setShowRecovery(false);
    }
    refresh();
  };

  const waitLeft = gate ? Math.max(0, Math.ceil((gate.readyAt - now) / 1000)) : 0;
  const sessionActive = !!status.active;
  const usageMissing = !hasCapability('usage');
  const overlayMissing = !hasCapability('overlay');

  const rowState = !status.enabled
    ? t('focus.off', { defaultValue: 'Off' })
    : needsPermissions
      ? t('focus.needsPermissions', { defaultValue: 'Needs permissions' })
      : t('focus.on', { defaultValue: 'On' });

  return (
    <div className='flex flex-col gap-6'>
      <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
        <h4 className='text-sm font-semibold text-gray-900 dark:text-white'>
          {t('focus.title', { defaultValue: 'Focus apps' })}
        </h4>
        <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>
          {t('focus.intro', {
            defaultValue: 'Pick the apps that pull you away. When you open one during a session, a calm card appears.',
          })}
        </p>
        <div className='mt-3 flex items-center justify-between gap-3'>
          <span className='text-sm text-gray-800 dark:text-zinc-200'>{rowState}</span>
          {!status.enabled ? (
            <button
              type='button'
              onClick={() => setShowDisclosure(true)}
              className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700'
            >
              {t('focus.turnOn', { defaultValue: 'Turn on' })}
            </button>
          ) : (
            <button
              type='button'
              onClick={() => {
                focusSetEnabled(false);
                refresh();
              }}
              className='min-h-[48px] rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 dark:border-zinc-700 dark:text-zinc-300'
            >
              {t('focus.turnOff', { defaultValue: 'Turn off' })}
            </button>
          )}
        </div>
        {status.enabled && needsPermissions && (
          <div className='mt-3 flex flex-wrap gap-2'>
            {usageMissing && (
              <button type='button' onClick={() => requestAccess('usage')} className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'>
                {t('focus.grantUsage', { defaultValue: 'Grant usage access' })}
              </button>
            )}
            {overlayMissing && (
              <button type='button' onClick={() => requestAccess('overlay')} className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'>
                {t('focus.grantOverlay', { defaultValue: 'Allow display over other apps' })}
              </button>
            )}
          </div>
        )}
      </div>

      {showDisclosure && (
        <div role='dialog' aria-modal='true' className='rounded-xl border border-gray-200 p-4 dark:border-zinc-700'>
          <h5 className='text-sm font-semibold'>{t('focus.disclosureTitle', { defaultValue: 'Before you turn this on' })}</h5>
          <ul className='mt-2 list-disc space-y-1 pl-5 text-xs text-gray-600 dark:text-zinc-400'>
            <li>{t('focus.disclosureApps', { defaultValue: 'Only the apps you choose are monitored.' })}</li>
            <li>{t('focus.disclosureRead', { defaultValue: 'Pico reads only the name of the app in front. It is not stored or uploaded.' })}</li>
            <li>{t('focus.disclosureWhen', { defaultValue: 'The card appears when a chosen app opens during a session.' })}</li>
            <li>{t('focus.disclosureOff', { defaultValue: 'Turn this off here, or revoke Usage access and Display over other apps in system settings.' })}</li>
          </ul>
          <div className='mt-3 flex gap-2'>
            <button type='button' onClick={turnOn} className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-sm text-white'>
              {t('focus.continue', { defaultValue: 'Continue' })}
            </button>
            <button type='button' onClick={() => setShowDisclosure(false)} className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'>
              {t('focus.notNow', { defaultValue: 'Not now' })}
            </button>
          </div>
        </div>
      )}

      {status.enabled && !sessionActive && (
        <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
          <h5 className='text-sm font-semibold'>{t('focus.appsTitle', { defaultValue: 'Apps to focus on' })}</h5>
          <input
            type='search'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('focus.searchApps', { defaultValue: 'Search apps' }) as string}
            className='mt-2 min-h-[48px] w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
          />
          <p className='mt-2 text-xs text-gray-500'>
            {t('focus.selectedCount', { defaultValue: '{{count}} selected', count: picked.length })}
          </p>
          {picked.length === 0 && (
            <p className='mt-1 text-xs text-gray-400'>
              {t('focus.noneChosen', { defaultValue: 'No apps chosen yet. Tick the apps you want to focus on.' })}
            </p>
          )}
          <ul className='mt-2 max-h-64 overflow-y-auto divide-y divide-gray-100 dark:divide-zinc-800'>
            {filtered.map((app) => (
              <li key={app.package}>
                <label className='flex min-h-[48px] items-center gap-3 text-sm'>
                  <input type='checkbox' checked={picked.includes(app.package)} onChange={() => togglePick(app.package)} className='h-4 w-4' />
                  {app.label}
                </label>
              </li>
            ))}
          </ul>

          <h5 className='mt-4 text-sm font-semibold'>{t('focus.startTitle', { defaultValue: 'Start a session' })}</h5>
          <div className='mt-2 flex flex-wrap gap-2'>
            {PRESETS.map((p) => (
              <button
                key={p.ms}
                type='button'
                onClick={() => setPreset(p.ms)}
                aria-pressed={preset === p.ms}
                className={`min-h-[48px] rounded-lg border px-3 py-2 text-sm ${preset === p.ms ? 'border-brand-600 font-medium' : ''}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className='mt-2 flex flex-col gap-2'>
            {STRENGTHS.map((s) => (
              <label key={s.id} className='flex min-h-[48px] items-center gap-2 text-sm'>
                <input type='radio' name='focus-strength' checked={strength === s.id} onChange={() => setStrength(s.id)} />
                <span>
                  {s.label} <span className='text-xs text-gray-500'>{s.help}</span>
                </span>
              </label>
            ))}
          </div>
          {!status.hasPasscode && (
            <div className='mt-3 flex flex-col gap-2'>
              <p className='text-xs text-gray-500'>
                {t('focus.setPasscode', { defaultValue: 'Set a passcode. It is stored only on this device.' })}
              </p>
              <input
                type='password'
                autoComplete='new-password'
                value={newPasscode}
                onChange={(e) => setNewPasscode(e.target.value)}
                placeholder={t('focus.passcode', { defaultValue: 'Passcode' }) as string}
                className='rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
              />
              <input
                type='password'
                autoComplete='new-password'
                value={confirmPasscode}
                onChange={(e) => setConfirmPasscode(e.target.value)}
                placeholder={t('focus.confirmPasscode', { defaultValue: 'Confirm passcode' }) as string}
                className='rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
              />
            </div>
          )}
          <button type='button' onClick={startSession} className='mt-4 min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white'>
            {t('focus.start', { defaultValue: 'Start focus session' })}
          </button>
        </div>
      )}

      {recoveryCode && (
        <div className='rounded-xl border border-amber-300 p-4'>
          <p className='text-sm font-semibold'>{t('focus.recoveryTitle', { defaultValue: 'Your recovery code' })}</p>
          <p className='mt-1 text-xs text-gray-600'>
            {t('focus.recoveryHelp', {
              defaultValue: 'Write this down now. It is shown only once and can reset your passcode if you forget it.',
            })}
          </p>
          <p className='mt-2 select-all font-mono text-base'>{recoveryCode}</p>
          <label className='mt-3 flex min-h-[48px] items-center gap-2 text-sm'>
            <input type='checkbox' checked={recoveryAck} onChange={(e) => setRecoveryAck(e.target.checked)} />
            {t('focus.recoveryAck', { defaultValue: 'I wrote it down' })}
          </label>
          <button
            type='button'
            disabled={!recoveryAck}
            onClick={() => {
              setRecoveryCode(null);
              setRecoveryAck(false);
            }}
            className='mt-2 min-h-[48px] rounded-lg border px-3 py-2 text-sm disabled:opacity-40'
          >
            {t('focus.recoveryDone', { defaultValue: 'Done' })}
          </button>
        </div>
      )}

      {sessionActive && (
        <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
          <h5 className='text-sm font-semibold'>{t('focus.activeTitle', { defaultValue: 'Focus session' })}</h5>
          <p className='mt-1 text-sm'>
            {t('focus.until', { defaultValue: 'You chose to focus until {{time}}.', time: new Date(status.endMs ?? 0).toLocaleString() })}
          </p>
          <p className='mt-1 text-xs text-gray-500'>
            {t('focus.score', { defaultValue: 'Focus score: {{score}}', score: status.score ?? 100 })} ·{' '}
            {t('focus.unblocksLeft', { defaultValue: 'Early unblocks left: {{n}}', n: status.unblocksLeft ?? 0 })}
          </p>
          <button
            type='button'
            onClick={() => openAppSettings()}
            className='mt-2 min-h-[48px] text-sm text-brand-600 underline dark:text-[#9EFF00]'
          >
            {t('focus.systemSettings', { defaultValue: 'Turn off overlay in system settings' })}
          </button>

          {!gate && (
            <div className='mt-3 flex flex-col gap-2'>
              {(status.unblocksLeft ?? 0) === 0 ? (
                <p className='text-sm'>
                  {t('focus.noUnblocks', { defaultValue: 'No early unblocks left for this session.' })}
                </p>
              ) : !unblockWarning ? (
                <button
                  type='button'
                  onClick={() => setUnblockWarning(true)}
                  className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'
                >
                  {t('focus.openEarly', { defaultValue: 'Open an app now' })}
                </button>
              ) : (
                <div className='rounded-lg border p-3 text-sm'>
                  <p>
                    {t('focus.warning', {
                      defaultValue: 'You chose to focus until {{time}}. Opening this now lowers your focus score. Continue?',
                      time: new Date(status.endMs ?? 0).toLocaleString(),
                    })}
                  </p>
                  <div className='mt-2 flex gap-2'>
                    <button type='button' autoFocus onClick={() => setUnblockWarning(false)} className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-white'>
                      {t('focus.keepFocusing', { defaultValue: 'Keep focusing' })}
                    </button>
                    <button
                      type='button'
                      onClick={() => {
                        setUnblockWarning(false);
                        requestGatedAction('early', status.strength === 'STRICT' ? WAIT_MS : 0);
                      }}
                      className='min-h-[48px] rounded-lg border px-3 py-2'
                    >
                      {t('focus.continue', { defaultValue: 'Continue' })}
                    </button>
                  </div>
                </div>
              )}
              {(status.unblocksLeft ?? 0) > 0 && (
                <button type='button' onClick={() => requestGatedAction('emergency', WAIT_MS)} className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'>
                  {t('focus.emergency', { defaultValue: 'Emergency: end session' })}
                </button>
              )}
            </div>
          )}

          {gate && gate.readyAt > now && (
            <div className='mt-3 flex flex-col gap-2 rounded-lg border p-3 text-sm'>
              <p>{t('focus.waiting', { defaultValue: 'Please wait {{s}} seconds.', s: waitLeft })}</p>
              <button type='button' onClick={() => setGate(null)} className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-white'>
                {t('focus.stayFocused', { defaultValue: 'Stay focused' })}
              </button>
            </div>
          )}

          {gate && gate.readyAt <= now && (
            <div className='mt-3 flex flex-col gap-2'>
              <input
                type='password'
                autoComplete='off'
                value={actionPasscode}
                onChange={(e) => setActionPasscode(e.target.value)}
                placeholder={t('focus.passcode', { defaultValue: 'Passcode' }) as string}
                className='rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
              />
              <button type='button' onClick={submitAction} className='min-h-[48px] rounded-lg bg-brand-600 px-3 py-2 text-white'>
                {gate.kind === 'emergency'
                  ? t('focus.endNow', { defaultValue: 'End session now' })
                  : t('focus.unblockNow', { defaultValue: 'Open for 10 minutes' })}
              </button>
            </div>
          )}
        </div>
      )}

      <div>
        <button type='button' onClick={() => setShowRecovery((v) => !v)} className='min-h-[48px] text-sm text-brand-600 underline dark:text-[#9EFF00]'>
          {t('focus.forgot', { defaultValue: 'Forgot passcode?' })}
        </button>
        {showRecovery && (
          <div className='mt-2 flex flex-col gap-2'>
            <input
              value={recoveryInput}
              onChange={(e) => setRecoveryInput(e.target.value)}
              placeholder={t('focus.recoveryCodeInput', { defaultValue: 'Recovery code' }) as string}
              className='rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            />
            <input
              type='password'
              autoComplete='new-password'
              value={recoveryNew}
              onChange={(e) => setRecoveryNew(e.target.value)}
              placeholder={t('focus.newPasscode', { defaultValue: 'New passcode' }) as string}
              className='rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900'
            />
            <button type='button' onClick={submitRecovery} className='min-h-[48px] rounded-lg border px-3 py-2 text-sm'>
              {t('focus.resetPasscode', { defaultValue: 'Reset passcode' })}
            </button>
          </div>
        )}
      </div>

      {message && <p role='status' className='text-xs text-gray-600 dark:text-zinc-300'>{message}</p>}
    </div>
  );
};

export default FocusApps;
