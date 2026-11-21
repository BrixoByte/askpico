import { describe, expect, it } from 'vitest';
import { canSendDraft } from './composerSend';

describe('canSendDraft', () => {
  it('is false for an empty or whitespace-only composer with no attachments', () => {
    expect(canSendDraft({ text: '', attachmentCount: 0 })).toBe(false);
    expect(canSendDraft({ text: '   \n\t', attachmentCount: 0 })).toBe(false);
  });

  it('is true when there is text or at least one attachment', () => {
    expect(canSendDraft({ text: 'hi', attachmentCount: 0 })).toBe(true);
    expect(canSendDraft({ text: '', attachmentCount: 1 })).toBe(true);
  });
});
