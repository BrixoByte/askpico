import React from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';

import PlusIcon from '@icon/PlusIcon';

import useAddChat from '@hooks/useAddChat';

const NewChat = ({ folder }: { folder?: string }) => {
  const { t } = useTranslation();
  const generating = useStore((state) => state.generating);
  const addChat = useAddChat();

  return (
    <button
      className={`flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-surface shadow-none transition-all hover:bg-ink-soft dark:bg-[#9EFF00] dark:text-black dark:hover:bg-[#86D900] max-md:py-3 max-md:text-base ${
        generating
          ? 'cursor-not-allowed opacity-40'
          : 'cursor-pointer'
      }`}
      onClick={() => {
        if (!generating) addChat(folder);
      }}
      aria-label={t('newChat') as string}
    >
      <PlusIcon className='h-4 w-4' />
      {t('newChat')}
    </button>
  );
};

export default NewChat;
