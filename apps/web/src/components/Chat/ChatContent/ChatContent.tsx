import React, { useEffect, useRef } from 'react';
import ScrollToBottom from 'react-scroll-to-bottom';
import useStore from '@store/store';

import ScrollToBottomButton from './ScrollToBottomButton';
import Message from './Message';
import EmptyState from './EmptyState';
import MobileHomeLayout from './MobileHomeLayout';
import AgentRouteBadge from './AgentRouteBadge';
import QuotaBanner from './QuotaBanner';
import { isMobileDevice, isNativeMobileApp } from '@utils/device';

import { shallow } from 'zustand/shallow';

const ChatContent = () => {
  const error = useStore((state) => state.error);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const advancedMode = useStore((state) => state.advancedMode);

  const chats = useStore(
    (state) =>
      state.chats &&
      state.chats.length > 0 &&
      state.currentChatIndex >= 0 &&
      state.currentChatIndex < state.chats.length
        ? state.chats
        : null,
    shallow
  );

  const messages =
    chats && currentChatIndex >= 0 && currentChatIndex < chats.length
      ? chats[currentChatIndex].messages
      : null;

  const hasMessages =
    messages?.some((message, index) => index !== 0 || message.role !== 'system') ??
    false;

  const messagesEndRef = useRef<HTMLDivElement>(null);

  if (!hasMessages) {
    return (
      <div className='flex h-full min-h-0 flex-1 flex-col overflow-y-auto'>
        <div
          className='fade-in mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-2'
        >
          {isNativeMobileApp() ? <MobileHomeLayout /> : !isMobileDevice() && <EmptyState />}
          <QuotaBanner />
          <div className='sticky bottom-0 z-10 mt-6 w-full max-w-2xl'>
            <Message
              role='user'
              content=''
              messageIndex={messages ? messages.length : 0}
              sticky
            />
          </div>
        </div>
        {error && (
          <div className='mx-auto mb-2 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600'>
            {error}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className='mx-[10%] mb-4 mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-slate-200/60 backdrop-blur-md sm:mb-1 sm:mt-6 md:-mt-12 dark:bg-zinc-900/40 dark:backdrop-blur-xl'>
      <div className='relative flex-1 min-h-0 overflow-hidden'>
        <ScrollToBottom
          className='h-full w-full'
          followButtonClassName='hidden'
          initialScrollBehavior='auto'
        >
          <div className='flex min-h-full w-full flex-col'>
            <div className='fade-in mx-auto w-full max-w-3xl px-4 pt-4 pb-6'>
              {messages?.map((message, index) =>
                !message.image && (advancedMode || index !== 0 || message.role !== 'system') ? (
                  <Message
                    role={message.role}
                    content={message.content}
                    messageIndex={index}
                    image={message.image}
                    images={message.images}
                    attachments={message.attachments}
                    toolJob={message.toolJob}
                    photos={message.photos}
                    replyFiles={
                      message.role === 'assistant'
                        ? message.files ?? messages?.[index - 1]?.files
                        : undefined
                    }
                    key={index}
                  />
                ) : null
              )}
            </div>
            <AgentRouteBadge />
          </div>
        </ScrollToBottom>
        <ScrollToBottomButton />
      </div>

      <div className='relative z-10 px-4 pb-5 pt-2'>
        <QuotaBanner />
        <div className='mx-auto w-full max-w-3xl'>
          <Message
            role='user'
            content=''
            messageIndex={messages ? messages.length : 0}
            sticky
          />
        </div>
        {error && (
          <div className='mx-auto mt-2 max-w-3xl rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600'>
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default ChatContent;
