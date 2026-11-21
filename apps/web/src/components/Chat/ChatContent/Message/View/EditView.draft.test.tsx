// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import useStore from '@store/store';
import type { ChatInterface } from '@type/chat';

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
  default: () => ({ handleSubmit: vi.fn(), error: null }),
}));
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

const DRAFT_KEY = 'pico_draft_c1';

describe('EditView draft after send', () => {
  beforeEach(() => {
    localStorage.clear();
    useStore.setState({ chats: [chat()], currentChatIndex: 0, generating: false, apiKey: 'x', error: '' });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    useStore.getState().setGenerating(false);
  });

  it('removes the saved draft as soon as the message is sent, so a remount does not restore it', async () => {
    render(<EditView content='' setIsEdit={() => {}} messageIndex={0} sticky />);
    const input = screen.getByPlaceholderText('Ask PICO anything...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'Say hi' } });
    // Let the 300 ms draft save run, so the draft is persisted.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 350));
    });
    expect(localStorage.getItem(DRAFT_KEY)).toBe('Say hi');

    fireEvent.click(screen.getByRole('button', { name: 'send message' }));
    // Checked synchronously: the send must not leave a draft behind for the next mount.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
