import React, { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useStore from '@store/store';
import useDraftStore from '@store/draft-store';

import useSubmit from '@hooks/useSubmit';
import { selectOrCreateChat } from '@hooks/useAddChat';
import { extractAttachmentText } from '@api/api';
import i18n from '@src/i18n';
import LockBadge from '@components/Auth/LockBadge';
import ModeSelector from '@components/Chat/ModeSelector';
import { gateSignedIn, useIsSignedIn } from '@utils/authGate';
import { tryDeviceIntent } from '@utils/agentIntents';
import { attachmentBlockReason } from '@constants/attachments';
import {
  convertImageFile,
  createThumbnailDataUrl,
  parseConvertTarget,
} from '@utils/imageConvert';

import { ChatInterface, MessageAttachmentInterface, ModelOptions } from '@type/chat';
import {
  fileExtensionOf,
  registerAttachmentFile,
} from '@utils/attachmentStore';

import PopupModal from '@components/PopupModal';
import { isMobileDevice } from '@utils/device';

import SendIcon from '@icon/SendIcon';
import { SparkleIcon } from '@icon/ui';
import { isSupportedAttachment, TEXT_EXTENSIONS } from '@utils/attachmentTypes';
import { canSendDraft } from '@utils/composerSend';

const ATTACH_MAX_BYTES = 10 * 1024 * 1024;

interface PendingAttachment {
  id: string;
  name: string;
  status: 'loading' | 'ready' | 'error';
  isImage?: boolean;
  file?: File;
  text?: string;
  error?: string;
}

const extensionOf = (name: string) => {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot).toLowerCase();
};

const readAsText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      if (text.includes('\u0000') || text.includes('\uFFFD')) reject(new Error(String(i18n.t('attachNotText'))));
      else resolve(text);
    };
    reader.onerror = () => reject(new Error(String(i18n.t('attachReadFail'))));
    reader.readAsText(file);
  });

const readAsBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? '').split(',')[1] ?? '');
    reader.onerror = () => reject(new Error(String(i18n.t('attachReadFail'))));
    reader.readAsDataURL(file);
  });

const EditView = ({
  content,
  setIsEdit,
  messageIndex,
  sticky,
}: {
  content: string;
  setIsEdit: React.Dispatch<React.SetStateAction<boolean>>;
  messageIndex: number;
  sticky?: boolean;
}) => {
  const setChats = useStore((state) => state.setChats);
  const currentChatIndex = useStore((state) => state.currentChatIndex);
  const setError = useStore((state) => state.setError);
  const currentModel = useStore((state) => state.chats?.[state.currentChatIndex]?.config.model);
  const defaultChatConfig = useStore((state) => state.defaultChatConfig);
  const setDefaultChatConfig = useStore((state) => state.setDefaultChatConfig);
  const activeModel = currentModel ?? defaultChatConfig?.model;

  const handleModeChange = (model: ModelOptions) => {
    const chats = useStore.getState().chats;
    if (chats?.[currentChatIndex]) {
      const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));
      updatedChats[currentChatIndex].config.model = model;
      setChats(updatedChats);
    } else if (defaultChatConfig) {
      setDefaultChatConfig({ ...defaultChatConfig, model });
    }
  };

  // Persist the composer draft per chat so a process kill / permission revoke
  // does not lose what the user typed. Restored on next mount of this chat.
  const draftKey = sticky
    ? `pico_draft_${
        currentChatIndex >= 0
          ? (useStore.getState().chats?.[currentChatIndex]?.id ?? currentChatIndex)
          : 'home'
      }`
    : null;
  const [_content, _setContent] = useState<string>(() => {
    if (content) return content;
    if (sticky && draftKey) {
      try {
        return localStorage.getItem(draftKey) ?? '';
      } catch {
        return '';
      }
    }
    return content;
  });
  useEffect(() => {
    if (!sticky || !draftKey) return;
    const t = setTimeout(() => {
      try {
        if (_content) localStorage.setItem(draftKey, _content);
        else localStorage.removeItem(draftKey);
      } catch {
        /* storage full/blocked */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [sticky, draftKey, _content]);
  const isMobile = isMobileDevice();
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const textareaRef = React.createRef<HTMLTextAreaElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const signedIn = useIsSignedIn();
  const outgoingContent = [
    _content.trim(),
    ...attachments
      .filter((a) => a.status === 'ready' && a.text)
      .map((a) => `[File: ${a.name}]\n${a.text}`),
  ]
    .filter(Boolean)
    .join('\n\n');
  const attachmentsPending = attachments.some((a) => a.status === 'loading');
  const sendBlocked = () => {
    if (outgoingContent === '' || attachmentsPending) return true;
    const reason = attachmentBlockReason(_content, attachments, currentModel);
    if (reason) setError(reason);
    return reason !== null;
  };

  const { t } = useTranslation();
  const generating = useStore((state) => state.generating);
  const draftContent = useDraftStore((state) => state.content);
  const setDraftContent = useDraftStore((state) => state.setContent);

  const resetTextAreaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile =
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|playbook|silk/i.test(
        navigator.userAgent
      );

    if (e.key === 'Enter' && !isMobile && !e.shiftKey) {
      e.preventDefault();
      if (sticky) {
        void sendSticky();
      } else {
        handleSave();
        handleSubmit();
      }
    }
  };

  const ensureActiveChat = () => {
    const { chats, currentChatIndex: index } = useStore.getState();
    if (!chats || !(index >= 0 && index < chats.length)) selectOrCreateChat();
  };

  const handleSave = () => {
    const updatedChats: ChatInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().chats)
    );
    const chatIndex = useStore.getState().currentChatIndex;
    updatedChats[chatIndex].messages[messageIndex].content = _content;
    updatedChats[chatIndex].messages = updatedChats[chatIndex].messages.slice(0, messageIndex + 1);
    setChats(updatedChats);
    setIsEdit(false);
  };

  const { handleSubmit } = useSubmit();

  const prepareOutgoing = async (): Promise<{
    content: string;
    fileContext: string;
    images: { name: string; url: string }[];
    files?: { name: string; url: string }[];
    attachments: MessageAttachmentInterface[];
    modelNote?: string;
  }> => {
    const text = _content.trim();
    const images = attachments.flatMap((a) =>
      a.isImage && a.status === 'ready' && a.file ? [{ name: a.name, file: a.file }] : []
    );
    const documents: MessageAttachmentInterface[] = attachments.flatMap((a) => {
      if (a.isImage || a.status === 'loading' || !a.file) return [];
      registerAttachmentFile(a.id, a.file);
      return [{ id: a.id, name: a.name, ext: fileExtensionOf(a.name) }];
    });
    const textParts = attachments
      .filter((a) => a.status === 'ready' && a.text)
      .map((a) => `[File: ${a.name}]\n${a.text}`);
    const content = text;
    const fileContext = textParts.join('\n\n');

    const previews = await Promise.all(
      images.map((image) =>
        createThumbnailDataUrl(image.file)
          .then((url) => ({ name: image.name, url }))
          .catch(() => null)
      )
    );
    const shownImages = previews.filter((p): p is { name: string; url: string } => p !== null);

    const target = images.length > 0 ? parseConvertTarget(text) : null;
    if (!target) {
      const modelNote =
        images.length > 0
          ? `Attached image(s): ${images.map((i) => i.name).join(', ')}. You cannot view image contents; say so briefly if the request needs visual analysis.`
          : undefined;
      return { content, fileContext, images: shownImages, attachments: documents, modelNote };
    }

    const results = await Promise.all(
      images.map((image) => convertImageFile(image.file, target).catch(() => null))
    );
    const files = results.filter((r): r is { name: string; url: string } => r !== null);
    const modelNote =
      files.length > 0
        ? `Tool note: the app has already converted the attached image(s) to ${target.toUpperCase()}, and the download card is shown to the user. Reply with one short sentence of at most 8 words confirming the conversion, for example: Your image has been converted to JPG. Do not ask for clarification and do not describe the image.`
        : `Tool note: converting the attached image(s) to ${target.toUpperCase()} failed in the browser. Tell the user briefly that the conversion failed.`;
    return { content, fileContext, images: shownImages, files, attachments: documents, modelNote };
  };

  const sendSticky = async () => {
    // While a reply is generating, a new user message would land AFTER the
    // assistant placeholder and steal the streamed reply (it renders as a
    // user bubble with the user icon).
    if (useStore.getState().generating || sendBlocked()) return;
    ensureActiveChat();
    const { content, fileContext, images, files, attachments: documents, modelNote } =
      await prepareOutgoing();
    const updatedChats: ChatInterface[] = JSON.parse(
      JSON.stringify(useStore.getState().chats)
    );
    const chatIndex = useStore.getState().currentChatIndex;
    updatedChats[chatIndex].messages.push({
      role: 'user',
      content,
      images,
      files,
      attachments: documents,
      fileContext,
      modelNote,
    });
    _setContent('');
    setAttachments([]);
    resetTextAreaHeight();
    setChats(updatedChats);
    // Device intents (open app/link, call, timer…) are answered natively —
    // no LLM round trip. Flag-gated; returns null on desktop / non-match.
    const deviceReply = await tryDeviceIntent(content);
    if (deviceReply !== null) {
      const patched: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
      patched[useStore.getState().currentChatIndex].messages.push({
        role: 'assistant',
        content: deviceReply,
      });
      setChats(patched);
      return;
    }
    handleSubmit();
  };

  const sendDisabled = !generating && !canSendDraft({ text: _content, attachmentCount: attachments.length });

  const handleGenerate = () => {
    if (useStore.getState().apiKey === '') {
      setIsModalOpen(true);
    } else if (sticky) {
      void sendSticky();
    } else {
      handleSave();
      handleSubmit();
    }
  };

  const addAttachment = async (file: File) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const update = (patch: Partial<PendingAttachment>) =>
      setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));

    setAttachments((prev) => [...prev, { id, name: file.name, status: 'loading', file }]);
    try {
      if (file.size > ATTACH_MAX_BYTES) throw new Error(String(t('attachTooLarge')));
      if (!isSupportedAttachment(file.name, file.type)) throw new Error(String(t('attachUnsupported')));
      if (file.type.startsWith('image/')) {
        update({ status: 'ready', isImage: true });
        return;
      }
      const text =
        file.type.startsWith('text/') || TEXT_EXTENSIONS.has(extensionOf(file.name))
          ? await readAsText(file)
          : await extractAttachmentText(file.name, await readAsBase64(file));
      update({ status: 'ready', text });
    } catch (err) {
      update({ status: 'error', error: (err as Error).message });
    }
  };

  const handleAttachFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    files.forEach((file) => {
      void addAttachment(file);
    });
  };

  const handleDraftSync = (value: string) => {
    if (value === '') return;
    _setContent((prev) => {
      const next = prev ? `${prev}${value}` : value;
      return next;
    });
    setDraftContent('');
    textareaRef.current?.focus();
  };

  useEffect(() => {
    if (sticky && draftContent !== '') handleDraftSync(draftContent);
  }, [draftContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
      textareaRef.current.style.maxHeight = '7.5rem';
    }
  }, [_content]);

  useEffect(() => {
    if (sticky && textareaRef.current) textareaRef.current.focus();
  }, []);

  return (
    <>
      <div
        className={`${
          sticky
            ? 'w-full pb-[env(safe-area-inset-bottom)]'
            : 'w-full max-w-2xl'
        }`}
      >
        <div
          className='flex flex-col overflow-hidden rounded-2xl border border-gray-200/80 bg-surface shadow-[0_2px_10px_rgba(17,24,28,0.08),0_1px_3px_rgba(17,24,28,0.05)] transition-all duration-200 ease-in-out focus-within:shadow-[0_2px_6px_rgba(17,12,46,0.06),0_16px_48px_rgba(80,60,140,0.12)] dark:border-zinc-800/80 dark:bg-zinc-900/90 dark:shadow-2xl dark:backdrop-blur-xl'
        >
          <div className='p-4'>
            {attachments.length > 0 && (
              <div className='mb-2 flex flex-wrap gap-2 px-2'>
                {attachments.map((a) => (
                  <span
                    key={a.id}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs ${
                      a.status === 'error'
                        ? 'border-red-200 bg-red-50 text-red-600'
                        : 'border-surface-line bg-surface-muted text-ink-soft'
                    }`}
                  >
                    {`${a.name}${
                      a.status === 'loading' ? ' (loading...)' : a.status === 'error' ? ` - ${a.error}` : ''
                    }`}
                    <button
                      type='button'
                      aria-label={`remove ${a.name}`}
                      onClick={() => setAttachments((prev) => prev.filter((x) => x.id !== a.id))}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className='relative flex items-start gap-2'>
            {sticky && (
              <span className='pointer-events-none absolute left-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md border border-[#8AE000]/30 bg-[#8AE000]/10 text-[#8AE000] dark:border-[#9EFF00]/30 dark:bg-[#9EFF00]/10 dark:text-[#9EFF00]'>
                <SparkleIcon className='h-5 w-5' />
              </span>
            )}
            <textarea
            ref={textareaRef}
            dir='auto'
            className={`m-0 max-h-[7.5rem] min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 pb-1 pt-2 text-sm leading-5 text-zinc-900 placeholder:text-zinc-400 dark:text-ink dark:placeholder:text-ink-muted focus:outline-none focus:ring-0 ${sticky ? 'pl-11' : ''}`}
            style={{ minHeight: '40px' }}
            onChange={(e) => {
              _setContent(e.target.value);
            }}
            value={_content}
            placeholder={sticky ? 'Ask PICO anything...' : (t('submitPlaceholder') as string)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
            {sticky && !isMobile && (
              <span className='hidden h-7 shrink-0 select-none items-center self-center whitespace-nowrap rounded-md border border-gray-300 px-1.5 text-[10px] text-gray-500 dark:border-zinc-700 dark:text-zinc-400 sm:inline-flex'>
                Ctrl + Enter ↵
              </span>
            )}
          </div>

          <div className='mt-2 flex h-12 items-center justify-between gap-2 border-t border-gray-200/60 px-3 py-1.5 dark:border-zinc-800'>
            <div className='flex flex-wrap items-center space-x-1'>
              {sticky && (
                <button
                  type='button'
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-zinc-100 text-zinc-600 transition-all duration-200 ease-in-out after:absolute after:-inset-1.5 after:content-[''] hover:border-emerald-500/30 hover:bg-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  onClick={() =>
                    gateSignedIn('Sign in to attach files.', () => fileInputRef.current?.click())
                  }
                  aria-label='attach file'
                >
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' className='h-4 w-4'>
                    <path d='M12 5v14M5 12h14' />
                  </svg>
                  {!signedIn && <LockBadge />}
                </button>
              )}
              {sticky && !isMobile && (
                <button
                  type='button'
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-zinc-100 text-zinc-600 transition-all duration-200 ease-in-out after:absolute after:-inset-1.5 after:content-[''] hover:border-emerald-500/30 hover:bg-zinc-200 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:bg-zinc-800/60"
                  onClick={() =>
                    gateSignedIn('Sign in to attach images.', () => imageInputRef.current?.click())
                  }
                  aria-label='attach image'
                >
                  <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' className='h-4 w-4'>
                    <rect x='3' y='3' width='18' height='18' rx='2' />
                    <circle cx='8.5' cy='8.5' r='1.5' />
                    <path d='M21 15l-5-5L5 21' />
                  </svg>
                  {!signedIn && <LockBadge />}
                </button>
              )}
              <input
                ref={fileInputRef}
                type='file'
                className='hidden'
                onChange={handleAttachFiles}
                multiple
              />
              <input
                ref={imageInputRef}
                type='file'
                accept='image/*'
                className='hidden'
                onChange={handleAttachFiles}
                multiple
              />
            </div>

            <div className='flex items-center space-x-1'>
              {sticky && activeModel && (
                <div className='flex h-12 w-[180px] [&>div]:h-full [&>div]:w-full [&_button]:h-full [&_button]:w-full [&_button]:justify-between [&_button]:border-zinc-200 dark:[&_button]:border-zinc-700 [&_button]:transition-all [&_button]:duration-200 [&_button]:hover:border-emerald-500/50 [&_button]:bg-white [&_button]:px-3 [&_button]:text-zinc-900 dark:[&_button]:bg-zinc-800 dark:[&_button]:text-zinc-200'>
                  <ModeSelector currentMode={activeModel} onModeChange={handleModeChange} />
                </div>
              )}
              {sticky && <span className='mx-2 my-auto h-5 w-[1px] bg-gray-200 dark:bg-zinc-800/80' />}
              <button
                type='button'
                className={`relative flex h-9 w-9 items-center justify-center rounded-full shadow-soft transition-all after:absolute after:-inset-1.5 after:content-[''] ${
                  generating
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-brand-500 text-white hover:bg-brand-600 dark:bg-[#9EFF00] dark:text-black dark:hover:bg-[#86D900]'
                } disabled:cursor-not-allowed disabled:opacity-40`}
                onClick={
                  generating
                    ? () => useStore.getState().setGenerating(false)
                    : handleGenerate
                }
                disabled={sendDisabled}
                aria-disabled={sendDisabled || undefined}
                aria-label={generating ? 'stop generating' : 'send message'}
              >
                {generating ? (
                  <svg
                    stroke='currentColor'
                    fill='none'
                    strokeWidth='1.5'
                    viewBox='0 0 24 24'
                    strokeLinecap='round'
                    strokeLinejoin='round'
                    className='h-3 w-3'
                    height='1em'
                    width='1em'
                    xmlns='http://www.w3.org/2000/svg'
                  >
                    <rect x='3' y='3' width='18' height='18' rx='2' ry='2'></rect>
                  </svg>
                ) : (
                  <SendIcon />
                )}
              </button>
            </div>
          </div>
          </div>

        </div>
      </div>

      {isModalOpen && (
        <PopupModal
          setIsModalOpen={setIsModalOpen}
          title={t('noAPIKeyWarning') as string}
          message={t('noAPIKeySubtitle') as string}
          handleConfirm={() => {
            setIsModalOpen(false);
            document.getElementById('api-menu')?.click();
          }}
        />
      )}
    </>
  );
};

export default memo(EditView);
