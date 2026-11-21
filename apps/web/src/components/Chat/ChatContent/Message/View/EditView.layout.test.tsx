// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

const renderComposer = () =>
  render(<EditView content='' setIsEdit={() => {}} messageIndex={0} sticky />);

// The send button's parent is the right-hand action group; the element holding
// the model selector wrapper (w-[180px]) is its first child.
const actionGroup = () => screen.getByRole('button', { name: 'send message' }).parentElement as HTMLElement;
const selectorWrapper = () => actionGroup().querySelector('[class*="w-[180px]"]') as HTMLElement;
const footerRow = () => actionGroup().parentElement as HTMLElement;
const leftGroup = () => footerRow().firstElementChild as HTMLElement;

describe('EditView composer layout', () => {
  beforeEach(() => {
    useStore.setState({ chats: [chat()], currentChatIndex: 0, generating: false, apiKey: 'x', error: '' });
  });

  afterEach(() => {
    cleanup();
    useStore.getState().setGenerating(false);
  });

  it('keeps the action group (model selector and send) from shrinking when the text wraps', () => {
    renderComposer();
    expect(actionGroup().className).toContain('shrink-0');
    expect(selectorWrapper().className).toContain('shrink-0');
  });

  it('lets the attach-button group wrap or shrink instead of pushing the action group out', () => {
    renderComposer();
    expect(leftGroup().className).toContain('min-w-0');
  });

  it('keeps the send control rendered and enabled-state intact with a two-line draft', () => {
    renderComposer();
    const input = screen.getByPlaceholderText('Ask PICO anything...') as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: 'first line of the draft\nsecond line of the draft' } });
    const send = screen.getByRole('button', { name: 'send message' });
    expect(send.isConnected).toBe(true);
    expect(actionGroup().className).toContain('shrink-0');
  });
});
