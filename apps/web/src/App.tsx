import React, { useCallback, useEffect, useState } from 'react';
import useStore from '@store/store';
import i18n from './i18n';

import Chat from '@components/Chat';
import Menu from '@components/Menu';
import ErrorBoundary from '@components/ErrorBoundary';
import SplashScreen from '@components/Splash/SplashScreen';
import { isMobileDevice } from '@utils/device';
import { enterChat } from '@utils/authRoutes';

import { prefetchEsbuildWasm } from '@utils/esbuildPrefetch';
import { pruneArtifactState } from '@utils/artifactState';
import { startMemorySync } from '@utils/memorySync';
import { captureReferralCode, claimStoredReferral } from '@utils/referral';
import { supabase } from '@api/supabase';
import { logger } from '@utils/logger';
import { chatIdFromSearch, chatSearchFor } from '@utils/chatRoute';
import { resolveTheme } from '@utils/theme';
import { ChatInterface } from '@type/chat';
import { Theme } from '@type/theme';
import { defaultModel, modelOptions } from '@constants/chat';
import Toast from '@components/Toast';
import UpgradePlanModal from '@components/UpgradeModal/UpgradePlanModal';
import AuthGateModal from '@components/Auth/AuthGateModal';
import ResetPasswordModal from '@components/Auth/ResetPasswordModal';
import PermissionPrompt from '@components/Permissions/PermissionPrompt';
import VoiceController from '@components/Voice/VoiceController';
import OfflineBanner from '@components/Chat/OfflineBanner';
import LowMemoryBanner from '@components/Chat/LowMemoryBanner';
import useUsageStore from '@store/usage-store';
import useProfileStore from '@store/profile-store';

function App() {
  const setChats = useStore((state) => state.setChats);
  const imageMode = useStore((state) => state.imageMode);
  const projectMode = useStore((state) => state.projectMode);
  const upgradeOpen = useUsageStore((state) => state.upgradeOpen);
  const setUpgradeOpen = useUsageStore((state) => state.setUpgradeOpen);
  const quotaOpen = useUsageStore((state) => state.quotaOpen);
  const setTheme = useStore((state) => state.setTheme);
  const theme = useStore((state) => state.theme);
  const setApiKey = useStore((state) => state.setApiKey);
  const setCurrentChatIndex = useStore((state) => state.setCurrentChatIndex);
  const [splashOpen, setSplashOpen] = useState(isMobileDevice);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const finishSplash = useCallback(async () => {
    if (await enterChat()) setSplashOpen(false);
  }, []);

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    i18n.on('languageChanged', (lng) => {
      document.documentElement.lang = lng;
    });
  }, []);

  useEffect(() => prefetchEsbuildWasm(), []);

  // Single source of truth for theme application: resolves 'system' via
  // prefers-color-scheme, applies the .dark/.light class, keeps Android
  // system-bar icon contrast in sync, and re-applies on OS theme changes.
  useEffect(() => {
    const apply = () => {
      const resolved = resolveTheme(useStore.getState().theme);
      document.documentElement.className = resolved;
      const bridge = (
        window as unknown as {
          PicoBridge?: { setSystemBars?: (darkBackground: boolean) => void };
        }
      ).PicoBridge;
      try {
        bridge?.setSystemBars?.(resolved === 'dark');
      } catch {
        // Older APKs lack setSystemBars on the injected bridge stub — ignore.
      }
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  useEffect(() => pruneArtifactState(), []);

  useEffect(() => startMemorySync(), []);

  useEffect(() => {
    captureReferralCode();
    void claimStoredReferral();
    const subscription = supabase?.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecoveryOpen(true);
      if (session && !session.user.is_anonymous) {
        const { email, user_metadata: meta } = session.user;
        useProfileStore.getState().setProfile({
          name: (meta?.full_name as string | undefined) ?? (meta?.name as string | undefined) ?? email?.split('@')[0] ?? '',
          email: email ?? '',
        });
        void claimStoredReferral();
      } else {
        useProfileStore.getState().setProfile({ name: '', email: '' });
      }
    });
    return () => subscription?.data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (
        event.key === 'free-chat-gpt' &&
        event.newValue !== null &&
        !useStore.getState().generating
      ) {
        const { chats, currentChatIndex } = useStore.getState();
        const activeChatId = chats?.[currentChatIndex]?.id;
        void useStore.persist.rehydrate()?.then(() => {
          const state = useStore.getState();
          const index = state.chats?.findIndex((chat) => chat.id === activeChatId) ?? -1;
          if (activeChatId && index >= 0 && index !== state.currentChatIndex) {
            state.setCurrentChatIndex(index);
          }
        });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    // legacy local storage
    const oldChats = localStorage.getItem('chats');
    const apiKey = localStorage.getItem('apiKey');
    const theme = localStorage.getItem('theme');

    if (apiKey) {
      // legacy local storage
      setApiKey(apiKey);
      localStorage.removeItem('apiKey');
    }

    if (theme) {
      // legacy local storage
      setTheme(theme as Theme);
      localStorage.removeItem('theme');
    }

    if (oldChats) {
      // legacy local storage
      try {
        const chats: ChatInterface[] = JSON.parse(oldChats);
        if (chats.length > 0) {
          setChats(chats);
          setCurrentChatIndex(0);
        }
      } catch (e: unknown) {
        logger.warn('legacy chat migration failed:', e);
      }
      localStorage.removeItem('chats');
    } else {
      // existing local storage
      const chats = useStore.getState().chats;
      const defaultChatConfig = useStore.getState().defaultChatConfig;
      if (!modelOptions.includes(defaultChatConfig.model)) {
        useStore.getState().setDefaultChatConfig({
          ...defaultChatConfig,
          model: defaultModel,
        });
      }
      const list = chats ?? [];
      setChats(
        list.map((chat) =>
          modelOptions.includes(chat.config.model)
            ? chat
            : { ...chat, config: { ...chat.config, model: defaultModel } }
        )
      );
    }
  }, []);

  useEffect(() => {
    const indexForSearch = (search: string) => {
      const routedId = chatIdFromSearch(search);
      const chats = useStore.getState().chats ?? [];
      return routedId ? chats.findIndex((chat) => chat.id === routedId) : -1;
    };

    const routedId = chatIdFromSearch(window.location.search);
    const index = indexForSearch(window.location.search);
    setCurrentChatIndex(index);
    if (routedId && index === -1) window.history.replaceState(null, '', '/');

    const onPopState = () => setCurrentChatIndex(indexForSearch(window.location.search));
    window.addEventListener('popstate', onPopState);

    const unsubscribe = useStore.subscribe((state, prev) => {
      if (state.currentChatIndex === prev.currentChatIndex) return;
      const chat = state.chats?.[state.currentChatIndex];
      const search = state.currentChatIndex >= 0 && chat ? chatSearchFor(chat.id) : '';
      if (window.location.search !== search) window.history.pushState(null, '', `/${search}`);
    });

    return () => {
      window.removeEventListener('popstate', onPopState);
      unsubscribe();
    };
  }, []);

  return (
    <div className='overflow-hidden w-full h-[100dvh] relative'>
      {splashOpen && <SplashScreen onDone={finishSplash} />}
      {!imageMode && !projectMode && <Menu />}
      <ErrorBoundary>
        <Chat />
      </ErrorBoundary>
      <Toast />
      <VoiceController />
      {upgradeOpen && <UpgradePlanModal onClose={() => setUpgradeOpen(false)} />}
      {quotaOpen && null /* quota UI is the inline QuotaBanner above the composer */}
      <AuthGateModal />
      <OfflineBanner />
      <LowMemoryBanner />
      {recoveryOpen && <ResetPasswordModal onClose={() => setRecoveryOpen(false)} />}
      <PermissionPrompt />
    </div>
  );
}

export default App;
