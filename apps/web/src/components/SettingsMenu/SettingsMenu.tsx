import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import useStore, { closeActiveChat } from '@store/store';
import useProfileStore, { profileDisplayName } from '@store/profile-store';

import SettingIcon from '@icon/SettingIcon';
import LanguageSelector from '@components/LanguageSelector';
import AutoTitleToggle from './AutoTitleToggle';
import AdvancedModeToggle from './AdvencedModeToggle';
import InlineLatexToggle from './InlineLatexToggle';
import AgentSettings from './AgentSettings';
import { isNativeApp } from '@utils/nativeAgent';

import PromptLibraryMenu from '@components/PromptLibraryMenu';
import ImportExportChat from '@components/ImportExportChat';
import EnterToSubmitToggle from './EnterToSubmitToggle';
import { TotalTokenCostToggle } from './TotalTokenCost';
import ClearConversation from '@components/Menu/MenuOptions/ClearConversation';
import Toggle from '@components/Toggle';
import SelectMenu from '@components/SelectMenu/SelectMenu';
import useMemoryStore from '@store/memory-store';
import type { ReplyLanguage } from '@store/config-slice';

import CrossIcon2 from '@icon/CrossIcon2';
import PersonIcon from '@icon/PersonIcon';
import ColorPaletteIcon from '@icon/ColorPaletteIcon';
import TickIcon from '@icon/TickIcon';
import DeleteIcon from '@icon/DeleteIcon';
import { FontStyle } from '@type/theme';
import { resolveTheme } from '@utils/theme';
import { deleteAccount, fetchReferralCode, fetchReferralStats, fetchUsage, type ReferralStats, type UsageSummary } from '@api/api';
import { isSignedInSession, supabase } from '@api/supabase';
import AuthModal from '@components/Auth/AuthModal';
import LockBadge from '@components/Auth/LockBadge';
import ReferralHub from '@components/ReferralHub';
import { gateSignedIn, useIsSignedIn } from '@utils/authGate';
import { marketingOrigin } from '@utils/authRoutes';

type SettingsSection =
  | 'general'
  | 'appearance'
  | 'memory'
  | 'agent'
  | 'advanced'
  | 'integrations'
  | 'data'
  | 'account';

type ThemeOption = 'light' | 'dark' | 'system';

const NavIcon = ({ children }: { children: React.ReactNode }) => (
  <svg
    viewBox='0 0 24 24'
    fill='none'
    stroke='currentColor'
    strokeWidth='2'
    strokeLinecap='round'
    strokeLinejoin='round'
    className='h-4 w-4'
  >
    {children}
  </svg>
);

const SlidersIcon = () => (
  <NavIcon>
    <line x1='4' y1='21' x2='4' y2='14' />
    <line x1='4' y1='10' x2='4' y2='3' />
    <line x1='12' y1='21' x2='12' y2='12' />
    <line x1='12' y1='8' x2='12' y2='3' />
    <line x1='20' y1='21' x2='20' y2='16' />
    <line x1='20' y1='12' x2='20' y2='3' />
    <line x1='1' y1='14' x2='7' y2='14' />
    <line x1='9' y1='8' x2='15' y2='8' />
    <line x1='17' y1='16' x2='23' y2='16' />
  </NavIcon>
);

const BrainIcon = () => (
  <NavIcon>
    <path d='M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z' />
    <path d='M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z' />
  </NavIcon>
);

const CpuIcon = () => (
  <NavIcon>
    <rect x='4' y='4' width='16' height='16' rx='2' />
    <rect x='9' y='9' width='6' height='6' />
    <path d='M15 2v2M15 20v2M2 15h2M2 9h2M20 15h2M20 9h2M9 2v2M9 20v2' />
  </NavIcon>
);

const BlocksIcon = () => (
  <NavIcon>
    <rect x='14' y='14' width='7' height='7' rx='1' />
    <rect x='3' y='14' width='7' height='7' rx='1' />
    <rect x='14' y='3' width='7' height='7' rx='1' />
    <rect x='3' y='3' width='7' height='7' rx='1' />
  </NavIcon>
);

const DatabaseIcon = () => (
  <NavIcon>
    <ellipse cx='12' cy='5' rx='9' ry='3' />
    <path d='M3 5v14a9 3 0 0 0 18 0V5' />
    <path d='M3 12a9 3 0 0 0 18 0' />
  </NavIcon>
);

const SectionHeading = ({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) => (
  <div>
    <h4 className='text-sm font-semibold text-gray-900 dark:text-white'>
      {title}
    </h4>
    <p className='mt-0.5 text-xs text-gray-500 dark:text-zinc-400'>{subtitle}</p>
  </div>
);

const MiniWindow = ({ dark = false }: { dark?: boolean }) => (
  <div className='flex h-full w-full overflow-hidden rounded-md'>
    <div className={`w-[32%] p-1.5 ${dark ? 'bg-gray-800' : 'bg-gray-100'}`}>
      <div className='mb-1.5 flex gap-0.5'>
        <span className='h-1 w-1 rounded-full bg-red-400' />
        <span className='h-1 w-1 rounded-full bg-yellow-400' />
        <span className='h-1 w-1 rounded-full bg-green-400' />
      </div>
      <div
        className={`mb-1 h-1 w-3/4 rounded-full ${
          dark ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      />
      <div
        className={`h-1 w-1/2 rounded-full ${
          dark ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      />
    </div>
    <div className={`flex-1 p-1.5 ${dark ? 'bg-gray-900' : 'bg-surface'}`}>
      <div
        className={`mb-1.5 h-1.5 w-2/3 rounded-full ${
          dark ? 'bg-gray-600' : 'bg-gray-300'
        }`}
      />
      <div
        className={`mb-1 h-1 w-full rounded-full ${
          dark ? 'bg-gray-700' : 'bg-gray-200'
        }`}
      />
      <div
        className={`h-1 w-4/5 rounded-full ${
          dark ? 'bg-gray-700' : 'bg-gray-200'
        }`}
      />
    </div>
  </div>
);

const ComingSoon = ({ label }: { label: string }) => (
  <div className='flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center'>
    <p className='text-sm font-medium text-gray-500 dark:text-zinc-400'>
      {label}
    </p>
    <p className='text-xs text-gray-400 dark:text-zinc-500'>Coming soon</p>
  </div>
);

export const SettingsPopup = ({
  setIsModalOpen,
  chatTools,
}: {
  setIsModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  chatTools?: React.ReactNode;
}) => {
  const { t } = useTranslation();

  const name = useProfileStore((state) => state.name);
  const email = useProfileStore((state) => state.email);
  const setProfile = useProfileStore((state) => state.setProfile);
  const displayName = profileDisplayName(name);
  const signedIn = useIsSignedIn();

  const theme = useStore((state) => state.theme);
  const setTheme = useStore((state) => state.setTheme);

  const fontStyle = useStore((state) => state.fontStyle);
  const setFontStyle = useStore((state) => state.setFontStyle);
  const systemMessage = useStore((state) => state.defaultSystemMessage);
  const setSystemMessage = useStore((state) => state.setDefaultSystemMessage);
  const memoryEnabled = useMemoryStore((state) => state.memoryEnabled);
  const memories = useMemoryStore((state) => state.items);
  const setMemoryEnabled = useMemoryStore((state) => state.setMemoryEnabled);
  const addMemory = useMemoryStore((state) => state.addMemory);
  const removeMemory = useMemoryStore((state) => state.removeMemory);
  const clearMemories = useMemoryStore((state) => state.clearMemories);

  const [section, setSection] = useState<SettingsSection>('general');
  const [themeOption, setThemeOption] = useState<ThemeOption>(theme);
  const [newMemory, setNewMemory] = useState('');
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const [confirmClearMemory, setConfirmClearMemory] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);
  const [referralStats, setReferralStats] = useState<ReferralStats | null>(null);
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState<boolean>(false);
  const [accountVersion, setAccountVersion] = useState<number>(0);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [usageError, setUsageError] = useState<string | null>(null);

  useEffect(() => {
    if (section !== 'account') return;
    let cancelled = false;
    fetchUsage()
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((err) => {
        if (!cancelled)
          setUsageError(err instanceof Error ? err.message : 'Usage could not be loaded.');
      });
    isSignedInSession().then(async (signedIn) => {
      if (cancelled) return;
      setIsSignedIn(signedIn);
      if (!signedIn) return;
      try {
        const code = await fetchReferralCode();
        if (!cancelled) setReferralCode(code);
        const stats = await fetchReferralStats();
        if (!cancelled) setReferralStats(stats);
      } catch (err) {
        if (!cancelled)
          setReferralError(err instanceof Error ? err.message : 'Referral link could not be loaded.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [section, accountVersion]);

  const referralLink = referralCode ? `${window.location.origin}/?ref=${referralCode}` : '';

  const handleDeleteAccount = async () => {
    setDeletingAccount(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      closeActiveChat();
      await supabase?.auth.signOut({ scope: 'local' });
      window.location.reload();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Account could not be deleted.');
      setDeletingAccount(false);
    }
  };

  const tokensUsed = usage?.tokensUsed ?? 0;
  const tokenLimit = usage?.tokenLimit ?? null;
  const tokenPct = tokenLimit ? Math.min(100, Math.round((tokensUsed / tokenLimit) * 100)) : 0;
  const planLabel = usage ? `${usage.plan.charAt(0).toUpperCase()}${usage.plan.slice(1)} plan` : '';

  const submitMemory = () => {
    if (newMemory.trim() === '') return;
    const error = addMemory(newMemory);
    setMemoryError(error);
    if (!error) setNewMemory('');
  };

  const modalRoot = document.getElementById('modal-root');

  const close = () => setIsModalOpen(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsModalOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setIsModalOpen]);

  // Keep the selected card in sync if the theme changes elsewhere.
  useEffect(() => {
    setThemeOption(theme);
  }, [theme]);

  const applyTheme = (option: ThemeOption) => {
    setThemeOption(option);
    setTheme(option);
  };

  const navItems: {
    id: SettingsSection;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { id: 'general', label: 'General', icon: <SlidersIcon /> },
    {
      id: 'appearance',
      label: 'Appearance',
      icon: <ColorPaletteIcon className='h-4 w-4' />,
    },
    { id: 'memory', label: 'Memory', icon: <BrainIcon /> },
    ...(isNativeApp() ? [{ id: 'agent' as SettingsSection, label: 'Agent', icon: <CpuIcon /> }] : []),
    { id: 'advanced', label: 'Advanced', icon: <CpuIcon /> },
    { id: 'account', label: 'Account', icon: <PersonIcon /> },
  ];

  const sectionTitles: Record<SettingsSection, string> = {
    general: 'General',
    appearance: 'Appearance',
    memory: 'Memory',
    agent: 'Agent',
    advanced: 'Advanced',
    integrations: 'Integrations',
    data: 'Data Controls',
    account: 'Account',
  };

  const themeCards: { id: ThemeOption; label: string }[] = [
    { id: 'light', label: 'Light' },
    { id: 'dark', label: 'Dark' },
    { id: 'system', label: 'System' },
  ];

  const fonts: { id: FontStyle; label: string; cls: string }[] = [
    { id: 'sans', label: 'Sans', cls: '' },
    { id: 'serif', label: 'Serif', cls: 'font-serif' },
    { id: 'mono', label: 'Monospace', cls: 'font-mono' },
  ];

  if (!modalRoot) return null;

  return ReactDOM.createPortal(
    <div
      className='fixed inset-0 z-[999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]'
      onClick={close}
    >
      <div
        className='relative flex h-[85vh] max-h-[92vh] min-h-[420px] w-[92vw] max-w-[900px] flex-col overflow-hidden rounded-xl bg-white text-zinc-900 shadow-2xl dark:bg-[#09090b] dark:text-zinc-100 sm:min-h-[550px] sm:flex-row'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Sidebar */}
        <aside className='flex w-full shrink-0 flex-row gap-1 overflow-x-auto overflow-y-hidden border-b border-zinc-200 bg-white p-2 text-zinc-900 dark:border-zinc-800 dark:bg-[#09090b] dark:text-zinc-100 sm:w-60 sm:flex-col sm:gap-0.5 sm:overflow-x-visible sm:overflow-y-auto sm:border-b-0 sm:border-r sm:p-3'>
          <h3 className='hidden px-2 pb-2 text-base font-semibold text-gray-900 dark:text-white sm:block'>
            {t('setting') as string}
          </h3>
          {navItems.map((item) => (
            <button
              key={item.id}
              type='button'
              onClick={() => setSection(item.id)}
              className={`flex min-h-[48px] shrink-0 items-center justify-start gap-2.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-left text-sm transition-all duration-200 ease-in-out ${
                section === item.id
                  ? 'border-gray-200 bg-white font-medium text-[#5a9400] shadow-sm dark:border-transparent dark:bg-zinc-800/80 dark:text-[#9EFF00] dark:shadow-none'
                  : 'border-transparent text-zinc-700 hover:border-emerald-500/40 hover:bg-transparent hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <span className='flex h-4 w-4 shrink-0 items-center justify-center'>
                {item.icon}
              </span>
              <span className='truncate'>{item.label}</span>
            </button>
          ))}
        </aside>

        {['advanced', 'integrations', 'data'].includes(section) && (
          <div className='absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/70 p-6 text-center backdrop-blur-sm sm:left-60 dark:bg-zinc-950/70'>
            <h4 className='text-lg font-semibold text-gray-900 dark:text-zinc-100'>Coming soon</h4>
            <p className='mt-2 text-sm text-gray-600 dark:text-zinc-400'>
              We are still building this section. Stay tuned.
            </p>
          </div>
        )}
        {/* Content */}
        <main className='relative flex-1 overflow-y-auto p-4 sm:p-8'>
          <button
            type='button'
            className='absolute right-4 top-4 z-30 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-900 after:absolute after:-inset-2 after:content-[""] dark:hover:bg-zinc-800 dark:hover:text-white'
            onClick={close}
            aria-label='close settings'
          >
            <CrossIcon2 />
          </button>

          <h2 className='mb-6 text-lg font-semibold text-gray-900 dark:text-white'>
            {sectionTitles[section]}
          </h2>

          <div key={section} className='fade-in'>
          {section === 'general' && (
            <div className='flex flex-col gap-6'>
              <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading title='Language' subtitle='Choose your interface language' />
                <div className='mt-3'>
                  <LanguageSelector />
                </div>
              </div>
              <div className='flex flex-col gap-4'>
                <SectionHeading title='Preferences' subtitle='Control chat behavior' />
                <EnterToSubmitToggle />
                <AutoTitleToggle />
              </div>
              {chatTools && (
                <div className='flex flex-col gap-3 border-t border-gray-100 pt-6 dark:border-zinc-800'>
                  <SectionHeading title='Chat tools' subtitle='Per-chat configuration' />
                  <div className='flex flex-wrap items-center gap-3'>{chatTools}</div>
                </div>
              )}
            </div>
          )}

          {section === 'appearance' && (
            <div className='flex flex-col'>
              {/* Theme */}
              <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading
                  title='Theme'
                  subtitle='Customize your UI theme'
                />
                <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
                  {themeCards.map((card) => {
                    const active = themeOption === card.id;
                    return (
                      <button
                        key={card.id}
                        type='button'
                        onClick={() => applyTheme(card.id)}
                        className={`relative flex-1 rounded-xl border-2 p-2 text-left transition-all duration-150 ${
                          active
                            ? 'border-brand-500 ring-1 ring-brand-500'
                            : 'border-gray-200 hover:border-gray-300 dark:border-zinc-700 dark:hover:border-zinc-600'
                        }`}
                      >
                        <div className='h-20 overflow-hidden rounded-lg border border-gray-200 dark:border-zinc-700'>
                          {card.id === 'system' ? (
                            <div className='flex h-full'>
                              <div className='w-1/2'>
                                <MiniWindow />
                              </div>
                              <div className='w-1/2'>
                                <MiniWindow dark />
                              </div>
                            </div>
                          ) : (
                            <MiniWindow dark={card.id === 'dark'} />
                          )}
                        </div>
                        <span className='mt-2 block text-center text-sm text-gray-700 dark:text-zinc-300'>
                          {card.label}
                        </span>
                        {active && (
                          <span className='absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white'>
                            <TickIcon className='h-3 w-3' />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font style */}
              <div className='py-6'>
                <div className='flex items-start justify-between gap-4'>
                  <SectionHeading
                    title='Font style'
                    subtitle='Choose your font style'
                  />
                  <div className='flex items-start gap-1'>
                    {fonts.map((f) => {
                      const active = fontStyle === f.id;
                      return (
                        <div key={f.id} className='flex flex-col items-center gap-1'>
                          <button
                            type='button'
                            onClick={() => setFontStyle(f.id)}
                            className={`rounded-lg px-3 py-1.5 text-lg transition-all duration-150 ${f.cls} ${
                              active
                                ? 'bg-gray-900 text-white dark:bg-white dark:text-zinc-900'
                                : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
                            }`}
                          >
                            Ag
                          </button>
                          {active && (
                            <span className='rounded-md bg-gray-900 px-2 py-0.5 text-[10px] text-white dark:bg-white dark:text-zinc-900'>
                              {f.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {section === 'memory' && (
            <div className='flex flex-col gap-6'>
              <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading
                  title='Personalized Memory'
                  subtitle='Manage what Pico remembers about you to personalize answers.'
                />
                <div className='mt-4'>
                  <Toggle
                    label='Enable Memory'
                    isChecked={memoryEnabled}
                    setIsChecked={() => setMemoryEnabled(!memoryEnabled)}
                  />
                </div>
              </div>

              <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading
                  title='Stored memories'
                  subtitle='Facts Pico currently remembers'
                />
                <div className='mt-3 flex gap-2'>
                  <input
                    type='text'
                    value={newMemory}
                    maxLength={300}
                    onChange={(e) => {
                      setNewMemory(e.target.value);
                      setMemoryError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && submitMemory()}
                    placeholder='Add a memory, e.g. "I prefer concise answers"'
                    className='flex-1 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
                  />
                  <button
                    type='button'
                    onClick={submitMemory}
                    className='rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700'
                  >
                    Add
                  </button>
                </div>
                {memoryError && (
                  <p className='mt-2 text-xs text-red-500'>{memoryError}</p>
                )}
                <ul className='mt-3 flex flex-col divide-y divide-gray-100 dark:divide-zinc-800'>
                  {memories.map((m) => (
                    <li
                      key={m.id}
                      className='flex items-center justify-between gap-3 py-2'
                    >
                      <span className='text-sm text-gray-700 dark:text-zinc-300'>
                        {m.text}
                      </span>
                      <button
                        type='button'
                        onClick={() => removeMemory(m.id)}
                        className='shrink-0 text-gray-400 transition-colors hover:text-red-500'
                        aria-label='delete memory'
                      >
                        <DeleteIcon />
                      </button>
                    </li>
                  ))}
                  {memories.length === 0 && (
                    <li className='py-3 text-xs text-gray-400 dark:text-zinc-500'>
                      No memories stored yet.
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <button
                  type='button'
                  onClick={() => setConfirmClearMemory(true)}
                  disabled={memories.length === 0}
                  className='rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-900/20'
                >
                  Clear All Memory
                </button>
              </div>
            </div>
          )}

          {section === 'agent' && <AgentSettings />}

          {section === 'advanced' && (
            <div className='flex flex-col gap-6'>
              <div className='flex flex-col gap-4 border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading title='Features' subtitle='Enable advanced features' />
                <InlineLatexToggle />
                <TotalTokenCostToggle />
                <AdvancedModeToggle />
              </div>
              <div>
                <SectionHeading
                  title='Custom System Instructions'
                  subtitle='Global system prompt override for Pico'
                />
                <textarea
                  rows={4}
                  value={systemMessage}
                  onChange={(e) => setSystemMessage(e.target.value)}
                  placeholder='e.g. Always respond in Roman Urdu'
                  className='mt-3 w-full resize-y rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
                />
              </div>
            </div>
          )}

          {section === 'integrations' && (
            <ComingSoon label='Integrations' />
          )}

          {section === 'data' && (
            <div className='flex flex-col gap-5'>
              <div className='rounded-xl border border-gray-200 p-4 dark:border-zinc-700'>
                <SectionHeading
                  title='Export Conversations'
                  subtitle='Import or download your chat history'
                />
                <div className='mt-3 flex flex-wrap items-center gap-3'>
                  <ImportExportChat />
                  <PromptLibraryMenu />
                </div>
              </div>
              <div className='rounded-xl border border-red-200 p-4 dark:border-red-900/50'>
                <SectionHeading
                  title='Clear All Chats'
                  subtitle='Permanently delete every conversation'
                />
                <div className='mt-3'>
                  <ClearConversation />
                </div>
              </div>
            </div>
          )}

          {section === 'account' && (
            <div className='flex flex-col gap-6'>
              <div className='flex items-center gap-4 border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <div className='flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-lg font-semibold text-white'>
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className='text-sm font-semibold text-gray-900 dark:text-white'>
                    {displayName}
                  </div>
                  <div className='text-xs text-gray-500 dark:text-zinc-400'>
                    {email || planLabel}
                  </div>
                </div>
              </div>

              <div className='border-b border-gray-100 pb-6 dark:border-zinc-800'>
                <SectionHeading
                  title='Profile'
                  subtitle='This information appears across Pico'
                />
                <div className='mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2'>
                  <div>
                    <label className='mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400'>
                      Display name
                    </label>
                    <input
                      type='text'
                      value={name}
                      readOnly={signedIn}
                      onChange={(e) => setProfile({ name: e.target.value })}
                      placeholder='Your name'
                      className='w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
                    />
                  </div>
                  <div>
                    <label className='mb-1 block text-xs font-medium text-gray-500 dark:text-zinc-400'>
                      Email
                    </label>
                    <input
                      type='email'
                      value={email}
                      readOnly={signedIn}
                      onChange={(e) => setProfile({ email: e.target.value })}
                      placeholder='you@example.com'
                      className='w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-white'
                    />
                  </div>
                </div>
                <p className='mt-2 text-xs text-gray-400 dark:text-zinc-500'>
                  Changes are saved automatically.
                </p>
              </div>
              <div className='flex flex-col gap-5'>
                <SectionHeading
                  title='Today’s usage'
                  subtitle={`${planLabel} · resets daily at midnight UTC`}
                />
                {usageError && <p className='text-xs text-red-500'>{usageError}</p>}
                <div>
                  <div className='flex justify-between text-xs text-gray-500 dark:text-zinc-400'>
                    <span>Tokens</span>
                    <span>
                      {tokenLimit
                        ? `${tokensUsed.toLocaleString()} / ${tokenLimit.toLocaleString()} today`
                        : `${tokensUsed.toLocaleString()} today`}
                    </span>
                  </div>
                  {tokenLimit && (
                    <div className='mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800'>
                      <div
                        className='h-full rounded-full bg-brand-600 transition-all duration-300'
                        style={{ width: `${tokenPct}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
              <div className='border-t border-gray-100 pt-6 dark:border-zinc-800'>
                <SectionHeading
                  title='Referral'
                  subtitle='Share your link. Rewards are added after your friend verifies email'
                />
                <div className='mt-3'>
                  <ReferralHub
                    isSignedIn={isSignedIn}
                    referralLink={referralLink}
                    stats={referralStats}
                    error={referralError}
                  />
                </div>
              </div>
              {!isSignedIn && (
                <div className='rounded-xl border border-gray-200 p-4 dark:border-zinc-800'>
                  <SectionHeading
                    title='Sign in'
                    subtitle='Sign in or create an account to keep your chats across devices'
                  />
                  <button
                    type='button'
                    onClick={() => setAuthOpen(true)}
                    className='mt-3 rounded-xl bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90'
                  >
                    Sign in or create account
                  </button>
                </div>
              )}
              <div className='rounded-xl border border-gray-200 p-4 dark:border-zinc-800'>
                <SectionHeading
                  title='Legal'
                  subtitle='Privacy policy, terms, and data deletion requests'
                />
                <div className='mt-3 flex flex-col gap-1'>
                  <a
                    className='inline-flex min-h-[48px] items-center text-sm text-brand-600 underline hover:text-brand-700 dark:text-[#9EFF00]'
                    href={`${marketingOrigin()}/privacy.html`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Privacy Policy
                  </a>
                  <a
                    className='inline-flex min-h-[48px] items-center text-sm text-brand-600 underline hover:text-brand-700 dark:text-[#9EFF00]'
                    href={`${marketingOrigin()}/terms.html`}
                    target='_blank'
                    rel='noreferrer'
                  >
                    Terms of Service
                  </a>
                </div>
              </div>
              <div className='rounded-xl border border-red-200 p-4 dark:border-red-900/50'>
                <SectionHeading
                  title='Delete account'
                  subtitle='Permanently remove your account and all of your data'
                />
                <button
                  type='button'
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmDeleteAccount(true);
                  }}
                  className='mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700'
                >
                  Delete account
                </button>
              </div>
            </div>
          )}
          </div>

          {authOpen && (
            <AuthModal
              onClose={() => setAuthOpen(false)}
              onSignedIn={() => {
                setAuthOpen(false);
                setIsSignedIn(true);
                setAccountVersion((v) => v + 1);
              }}
            />
          )}

          {confirmDeleteAccount && (
            <div
              className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4'
              onClick={() => !deletingAccount && setConfirmDeleteAccount(false)}
            >
              <div
                role='alertdialog'
                aria-modal='true'
                aria-labelledby='delete-account-title'
                aria-describedby='delete-account-desc'
                className='w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl dark:bg-zinc-950'
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id='delete-account-title' className='text-base font-semibold text-gray-900 dark:text-white'>
                  Delete your account?
                </h3>
                <p id='delete-account-desc' className='mt-2 text-sm leading-relaxed text-gray-500 dark:text-zinc-400'>
                  This permanently deletes your account, chats, memory and settings. This cannot be undone.
                </p>
                {deleteError && <p className='mt-3 text-sm text-red-600'>{deleteError}</p>}
                <div className='mt-5 flex justify-end gap-3'>
                  <button
                    type='button'
                    disabled={deletingAccount}
                    className='rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 disabled:opacity-50 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-800'
                    onClick={() => setConfirmDeleteAccount(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    disabled={deletingAccount}
                    className='rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50'
                    onClick={handleDeleteAccount}
                  >
                    {deletingAccount ? 'Deleting...' : 'Delete account'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {confirmClearMemory && (
            <div
              className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4'
              onClick={() => setConfirmClearMemory(false)}
            >
              <div
                role='alertdialog'
                aria-modal='true'
                aria-labelledby='clear-memory-title'
                aria-describedby='clear-memory-desc'
                className='w-full max-w-sm rounded-2xl bg-surface p-6 shadow-2xl dark:bg-zinc-950'
                onClick={(e) => e.stopPropagation()}
              >
                <h3 id='clear-memory-title' className='text-base font-semibold text-gray-900 dark:text-white'>
                  Clear all memory?
                </h3>
                <p id='clear-memory-desc' className='mt-2 text-sm leading-relaxed text-gray-500 dark:text-zinc-400'>
                  This permanently deletes every stored memory. Pico will stop
                  personalizing answers based on them.
                </p>
                <div className='mt-5 flex justify-end gap-3'>
                  <button
                    type='button'
                    className='rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-zinc-800 dark:text-gray-200 dark:hover:bg-zinc-800'
                    onClick={() => setConfirmClearMemory(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    className='rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700'
                    onClick={() => {
                      clearMemories();
                      setConfirmClearMemory(false);
                    }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>,
    modalRoot
  );
};

const SettingsMenu = () => {
  const { t } = useTranslation();

  const theme = useStore((state) => state.theme);
  const fontStyle = useStore((state) => state.fontStyle);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const signedIn = useIsSignedIn();

  useEffect(() => {
    document.documentElement.className = resolveTheme(theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.font = fontStyle;
  }, [fontStyle]);
  return (
    <>
      <a
        className="relative flex py-2.5 px-3 items-center gap-3 rounded-lg hover:bg-gray-100/80 transition-colors text-ink cursor-pointer text-sm dark:hover:bg-neutral-800 after:absolute after:-inset-y-1 after:content-['']"
        onClick={() => {
          void gateSignedIn('Sign in to open settings.', () => setIsModalOpen(true));
        }}
      >
        <SettingIcon className='w-4 h-4' /> {t('setting') as string}
        {!signedIn && <LockBadge />}
      </a>
      {isModalOpen && <SettingsPopup setIsModalOpen={setIsModalOpen} />}
    </>
  );
};

export default SettingsMenu;
