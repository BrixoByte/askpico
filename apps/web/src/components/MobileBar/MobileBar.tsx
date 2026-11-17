import React from 'react';
import { shallow } from 'zustand/shallow';
import useStore from '@store/store';
import PlusIcon from '@icon/PlusIcon';
import { PanelLeftIcon } from '@icon/ui';
import useAddChat from '@hooks/useAddChat';
import { useTranslation } from 'react-i18next';
import ModeSelector from '@components/Chat/ModeSelector';
import { ModelOptions } from '@type/chat';
import { isNativeMobileApp } from '@utils/device';

const MobileBar = () => {
  const generating = useStore((state) => state.generating);
  const setHideSideMenu = useStore((state) => state.setHideSideMenu);
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);

  const chatConfig = useStore(
    (state) =>
      state.chats &&
      state.chats.length > 0 &&
      state.currentChatIndex >= 0 &&
      state.currentChatIndex < state.chats.length
        ? state.chats[state.currentChatIndex].config
        : undefined,
    shallow
  );
  const defaultConfig = useStore((state) => state.defaultChatConfig);
  const setDefaultChatConfig = useStore((state) => state.setDefaultChatConfig);
  const config = chatConfig ?? defaultConfig;

  const addChat = useAddChat();
  const { t } = useTranslation();

  const handleModeChange = (model: ModelOptions) => {
    if (!config) return;
    if (!chatConfig) {
      setDefaultChatConfig({ ...config, model });
      return;
    }
    const updatedChats = JSON.parse(
      JSON.stringify(useStore.getState().chats)
    );
    updatedChats[currentChatIndex].config = { ...config, model };
    setChats(updatedChats);
  };

  return (
    <div className={`sticky left-0 top-0 z-10 flex w-full items-center gap-1 bg-transparent text-ink md:hidden ${
      isNativeMobileApp() ? 'px-4 pb-2 pt-[calc(0.75rem+env(safe-area-inset-top))]' : 'px-2 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))]'
    }`}>
      <button
        className="-ml-0.5 -mt-0.5 relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted after:absolute after:-inset-2 after:content-[''] hover:bg-ink/5 hover:text-ink"
        onClick={() => {
          setHideSideMenu(false);
        }}
        aria-label='menu'
      >
        <PanelLeftIcon className='h-4 w-4' />
      </button>
      <div className='flex min-w-0 flex-1 items-center justify-center'>
        {config && (
          <ModeSelector
            currentMode={config.model}
            onModeChange={handleModeChange}
            placement='down'
          />
        )}
      </div>
      <button
        className="-mr-0.5 -mt-0.5 relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted after:absolute after:-inset-2 after:content-[''] hover:bg-ink/5 hover:text-ink"
        onClick={() => {
          if (!generating) addChat();
        }}
        aria-label={t('newChat') as string}
      >
        <PlusIcon className='h-4 w-4' />
      </button>
    </div>
  );
};

export default MobileBar;
