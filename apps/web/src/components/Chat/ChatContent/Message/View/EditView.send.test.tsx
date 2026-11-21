// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import useStore from '@store/store';
import type { ChatInterface } from '@type/chat';

const { handleSubmitMock } = vi.hoisted(() => ({ handleSubmitMock: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));
vi.mock('@src/i18n', () => ({ default: { t: (k: string) => k } }));
vi.mock('@api/api', () => ({ extractAttachmentText: vi.fn() }));
vi.mock('@api/supabase', () => ({
  supabase: null,
  isSignedInSession: async () => false,
}));
vi.mock('@utils/agentIntents', () => ({ tryDeviceIntent: async () => null }));
vi.mock('@hooks/useSubmit', () => ({
  default: () => ({ handleSubmit: handleSubmitMock, error: null }),
}));
vi.mock('@components/Chat/ModeSelector', () => ({ default: () => null }));
vi.mock('@components/Auth/LockBadge', () => ({ default: () => null }));

import EditView from './EditView';

const chat = (): ChatInterface => ({
  id: 'c1',
  title: 'T',
  messages: [],
  titleSet: true,
  config: {
    model: 'auto',
    max_tokens: 100,
    temperature: 1,
    presence_penalty: 0,
    top_p: 1,
    frequency_penalty: 0,
  },
});

const userMessages = () =>
  (useStore.getState().chats?.[0]?.messages ?? []).filter((m) => m.role === 'user');

const flush = () => act(async () => new Promise((r) => setTimeout(r, 20)));

describe('EditView sticky send', () => {
  beforeEach(() => {
    handleSubmitMock.mockReset();
    handleSubmitMock.mockImplementation(async () => {
      if (useStore.getState().generating) return;
      useStore.getState().setGenerating(true);
      // Stays pending like a real stream; generating is the stop state.
      await new Promise(() => {});
    });
    useStore.setState({
      chats: [chat()],
      currentChatIndex: 0,
      generating: false,
      apiKey: 'x',
      error: '',
    });
  });

  afterEach(() => {
    cleanup();
    useStore.getState().setGenerating(false);
  });

  it('sends exactly one user message on a rapid double send', async () => {
    render(<EditView content='' setIsEdit={() => {}} messageIndex={0} sticky />);
    const input = await screen.findByPlaceholderText('Ask PICO anything...');
    fireEvent.change(input, { target: { value: 'Say hi' } });
    const send = screen.getByRole('button', { name: 'send message' });
    fireEvent.click(send);
    fireEvent.click(send);
    await flush();

    expect(userMessages()).toHaveLength(1);
    expect(handleSubmitMock).toHaveBeenCalledTimes(1);
  });

  it('disables the send control while a send is still in flight', async () => {
    render(<EditView content='' setIsEdit={() => {}} messageIndex={0} sticky />);
    const input = await screen.findByPlaceholderText('Ask PICO anything...');
    fireEvent.change(input, { target: { value: 'Say hi' } });
    const send = screen.getByRole('button', { name: 'send message' });
    fireEvent.click(send);
    // Synchronously after the first send starts (before it settles).
    expect((send as HTMLButtonElement).disabled).toBe(true);
    expect(send.getAttribute('aria-disabled')).toBe('true');
    await flush();
  });
});
