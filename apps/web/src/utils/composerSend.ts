// The composer can send when there is something to send. An empty draft keeps the send button disabled.
export const canSendDraft = ({ text, attachmentCount }: { text: string; attachmentCount: number }): boolean =>
  text.trim() !== '' || attachmentCount > 0;
