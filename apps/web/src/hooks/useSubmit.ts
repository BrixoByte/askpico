import React from 'react';
import useStore from '@store/store';
import { useTranslation } from 'react-i18next';
import { ChatInterface, MessageInterface, StockPhoto } from '@type/chat';
import {
  askSpecialistAgent,
  getChatCompletion,
  getChatCompletionStream,
  RouteResult,
  routeToAgent,
  summarizeThreadFocus,
  ThreadContext,
  verifyReplyText,
  truncateAgentHistory,
  SignInRequiredError,
} from '@api/api';
import useAuthGateStore from '@store/auth-gate-store';
import { getAttachmentFile } from '@utils/attachmentStore';
import { convertPdfPages, pdfPageCount } from '@utils/pdfToPng';
import { parseEventSource } from '@api/helper';
import { limitMessageTokens, updateTotalTokenUsed } from '@utils/messageUtils';
import { selectContextWindow } from '@utils/contextWindow';
import useMemoryStore from '@store/memory-store';
import useUsageStore, { FREE_DEEP_LIMIT } from '@store/usage-store';
import useVoiceStore from '@store/voice-store';
import { _defaultChatConfig } from '@constants/chat';
import { extractArtifacts } from '@utils/artifactParser';
import { prefetchMermaidAssets } from '@utils/mermaidDoc';
import { withTimeout } from '@utils/verifyLink';
import { logger } from '@utils/logger';
import { consumeRouteBypass } from '@utils/routeBypass';

// A hung request or stalled stream must never leave `generating` on forever —
// error out with a friendly message so the user can resend (60 s is generous:
// streamed tokens arrive continuously once the response starts).
const REQUEST_TIMEOUT_MS = 60_000;
const timed = <T,>(promise: Promise<T>, friendly: string): Promise<T> =>
  withTimeout(promise, REQUEST_TIMEOUT_MS).catch((e) => {
    throw (e as Error).message === 'timeout' ? new Error(friendly) : e;
  });

const syncArtifacts = (
  chatId: string,
  messageIndex: number,
  content: string,
  final: boolean
) => {
  const detected = extractArtifacts(content, chatId, messageIndex);
  if (detected.length === 0) return;
  if (detected.some((a) => a.language === 'mermaid')) prefetchMermaidAssets();

  const state = useStore.getState();
  const prefix = `${chatId}-${messageIndex}-`;
  const previousCount = state.artifacts.filter((a) =>
    a.id.startsWith(prefix)
  ).length;
  state.setArtifacts([
    ...state.artifacts.filter((a) => !a.id.startsWith(prefix)),
    ...detected,
  ]);

  if (final) {
    state.setActiveArtifactTab(
      detected.length === 1 && detected[0].type !== 'code' ? 'preview' : 'code'
    );
    state.openArtifactPanel(detected[0].id);
  } else if (detected.length > previousCount) {
    state.setActiveArtifactTab('code');
    state.openArtifactPanel(detected[detected.length - 1].id);
  }
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const trace = (step: string, detail?: unknown) => {
  if (import.meta.env.DEV) console.info(`[Pico] ${step}`, detail ?? '');
};

const replaceLastAssistant = (chatIndex: number, patch: Partial<MessageInterface>) => {
  const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
  const messages = updatedChats[chatIndex].messages;
  Object.assign(messages[messages.length - 1], patch);
  useStore.getState().setChats(updatedChats);
};

const runBrowserTool = async (chatIndex: number, toolId: string, userMessage?: MessageInterface) => {
  const attachment = userMessage?.attachments?.find((a) => a.ext === '.pdf');
  if (toolId !== 'pdf-to-png' || !attachment) {
    replaceLastAssistant(chatIndex, { content: 'Is tool ke liye sahi file nahi mili.' });
    return;
  }
  const file = getAttachmentFile(attachment.id);
  if (!file) {
    replaceLastAssistant(chatIndex, {
      content: 'Ye PDF ab available nahi hai (page refresh ho gaya). Please dobara attach karein.',
    });
    return;
  }

  try {
    const pageCount = await pdfPageCount(file);
    if (pageCount === 1) {
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const files = await convertPdfPages(file, [1], baseName);
      replaceLastAssistant(chatIndex, { content: 'Your PDF page has been converted to PNG.', files });
      return;
    }
    replaceLastAssistant(chatIndex, {
      content: `This PDF has ${pageCount} pages. Which pages should I convert?`,
      toolJob: { toolId, fileId: attachment.id, pageCount, status: 'awaiting' },
    });
  } catch (e: unknown) {
    replaceLastAssistant(chatIndex, { content: `PDF conversion failed: ${(e as Error).message}` });
  }
};

const describeNow = (locationTimeZone?: string): string => {
  const now = new Date();
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const deviceTime = now.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: deviceZone,
  });
  const locationPart = locationTimeZone
    ? `\nCurrent time in the requested location (${locationTimeZone}): ${now.toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: locationTimeZone,
      })}`
    : '';
  return `Current time on the user's device (${deviceZone}): ${deviceTime}${locationPart}`;
};

// Structured fact anchor refreshes every ~2 turns (4 messages) so decisions
// like budgets and goals land in the anchor before the raw text drops away.
const FOCUS_REFRESH_BATCH = 4;
const COMPLETION_TOKENS_DEFAULT = 2048;
const COMPLETION_TOKENS_MAX = 4096;

const threadRecentMessages = (messages: MessageInterface[]) =>
  messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && !m.image && m.content.trim() !== '')
    .slice(-6)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

const activeMemories = (): string[] => {
  const { memoryEnabled, items } = useMemoryStore.getState();
  return memoryEnabled ? items.map((item) => item.text) : [];
};

const toModelMessage = (message: MessageInterface): MessageInterface => ({
  role: message.role,
  content: [message.content, message.fileContext, message.modelNote].filter(Boolean).join('\n\n'),
});

const useSubmit = () => {
  const { i18n } = useTranslation('api');
  const error = useStore((state) => state.error);
  const setError = useStore((state) => state.setError);
  const setGenerating = useStore((state) => state.setGenerating);
  const generating = useStore((state) => state.generating);
  const setChats = useStore((state) => state.setChats);

  const generateTitle = async (
    message: MessageInterface[]
  ): Promise<string> => {
    let data;
    try {
      data = await getChatCompletion(message);
    } catch (error: unknown) {
      throw new Error(`Error generating title!\n${(error as Error).message}`);
    }
    return data.choices[0].message.content;
  };

  const patchChat = (index: number, patch: Partial<ChatInterface>) => {
    const next: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
    Object.assign(next[index], patch);
    setChats(next);
  };

  const handleSubmit = async () => {
    const chats = useStore.getState().chats;
    // Read generating fresh: voice barge-in can flip it false microseconds
    // before this runs, and the hook value may lag a render behind.
    if (useStore.getState().generating || !chats) return;
    const currentChatIndex = useStore.getState().currentChatIndex;
    const requestType =
      useVoiceStore.getState().pendingVoiceTurn
        ? 'voice'
        : 'text';
    useVoiceStore.getState().setPendingVoiceTurn(false);

    // Deep mode is capped per day on the free plan.
    if (
      chats[currentChatIndex].config.model === 'deep' &&
      !useUsageStore.getState().consumeDeep()
    ) {
      // Inline banner, not a centered modal — the composer must stay reachable.
      const usage = useUsageStore.getState();
      usage.setQuotaKind('cap');
      let dismissedRecently = false;
      try {
        const at = Number(localStorage.getItem('pico_quota_modal_dismissed_at') ?? 0);
        dismissedRecently = Date.now() - at < 7 * 24 * 60 * 60 * 1000;
      } catch {
        dismissedRecently = false;
      }
      if (!dismissedRecently) usage.setQuotaOpen(true);
      setError(
        `Daily limit reached: Deep mode allows ${FREE_DEEP_LIMIT} messages per day on the free plan.`
      );
      return;
    }

    const updatedChats: ChatInterface[] = JSON.parse(JSON.stringify(chats));

    updatedChats[currentChatIndex].updatedAt = Date.now();
    updatedChats[currentChatIndex].messages.push({
      role: 'assistant',
      content: '',
    });

    setChats(updatedChats);
    setGenerating(true);

    try {
      let stream;
      if (chats[currentChatIndex].messages.length === 0)
        throw new Error('No messages submitted!');

      const threadMessages = chats[currentChatIndex].messages
        .filter((message) => !message.image)
        .map(toModelMessage);
      const windowedMessages = selectContextWindow(threadMessages);
      const messages = limitMessageTokens(
        windowedMessages,
        chats[currentChatIndex].config.max_tokens,
        chats[currentChatIndex].config.model
      );
      if (messages.length === 0) throw new Error('Message exceed max token!');

      const selectedMode = chats[currentChatIndex].config.model;
      const lastUserMessage = [...chats[currentChatIndex].messages]
        .reverse()
        .find((m) => m.role === 'user');
      const lastUserText = lastUserMessage?.content;
      const memories = activeMemories();
      const droppedByWindow = threadMessages.length - windowedMessages.length;
      trace(`0. memory: ${memories.length} saved memories attached`, memories);
      trace(`0. context: thread=${threadMessages.length} sent=${messages.length}`, {
        droppedByWindow,
        droppedByTokens: windowedMessages.length - messages.length,
      });
      if (
        typeof lastUserText === 'string' &&
        /pehle|pichli|dusri|doosri|other chat|previous|earlier|before|yaad|remember/i.test(lastUserText)
      ) {
        trace('0. memory: cross-thread cue detected, server will run vector recall');
      }

      const storedChat = chats[currentChatIndex];
      const focus = storedChat.focus ?? '';
      const focusUpTo = storedChat.focusUpTo ?? 0;
      const pendingFocus =
        droppedByWindow - focusUpTo >= FOCUS_REFRESH_BATCH
          ? threadMessages.slice(focusUpTo, droppedByWindow)
          : null;
      const threadContext: ThreadContext = {
        focus,
        recent: threadRecentMessages(chats[currentChatIndex].messages.slice(0, -1)),
        stickyAgentId: chats[currentChatIndex].lastAgentId ?? null,
      };
      let agentReply: string | null = null;
      let toolHandled = false;
      // Live tool payload + injected current time — also fed to the reply
      // verifier so tool figures and "now" statements count as grounded
      // context instead of being flagged unverified.
      let liveToolData = '';
      let liveNowInfo = '';
      const fileExtensions = [...new Set((lastUserMessage?.attachments ?? []).map((a) => a.ext))];
      // Voice turns go straight to the core chat stream: the routing round-trip
      // (and history cleanup) would add seconds before the first spoken word.
      const bypassRouting = consumeRouteBypass();
      if (requestType !== 'voice' && !bypassRouting && typeof lastUserText === 'string' && lastUserText.trim() !== '') {
        const { setHandoff } = useStore.getState();
        const chatId = chats[currentChatIndex].id;
        const userTurn = chats[currentChatIndex].messages.map((m) => m.role).lastIndexOf('user');
        await truncateAgentHistory(chatId, userTurn).catch((err: unknown) =>
          trace('0. history: cleanup failed', (err as Error).message)
        );
        setHandoff({ agentId: null, stage: 'routing' });
        trace('1. routing: POST /api/agent/route', { chars: lastUserText.length });
        let route: RouteResult | null = null;
        try {
          route = await routeToAgent(lastUserText, fileExtensions, threadContext);
        } catch (err) {
          if (err instanceof SignInRequiredError) {
            toolHandled = true;
            useAuthGateStore.getState().open(err.message);
            replaceLastAssistant(currentChatIndex, { content: '' });
          } else if (fileExtensions.length === 0) {
            trace('1. routing: request threw, using core', (err as Error).message);
          } else {
            toolHandled = true;
            replaceLastAssistant(currentChatIndex, { content: (err as Error).message });
          }
        }
        const agentId = route?.agentId ?? null;
        if (agentId) patchChat(currentChatIndex, { lastAgentId: agentId });
        if (route?.toolError) {
          toolHandled = true;
          trace(`2. routing: live tool "${route.toolId}" failed`, route.toolError);
          replaceLastAssistant(currentChatIndex, { content: route.toolError });
        } else if (route?.location === 'external' && route.toolId && route.data && agentId) {
          trace(`2. routing: live tool "${route.toolId}"`);
          if (route.toolId === 'stock') {
            toolHandled = true;
            const photos = (route.data as { photos: StockPhoto[] }).photos;
            replaceLastAssistant(currentChatIndex, {
              content:
                photos.length > 0
                  ? `${photos.length} photos mil gayi hain.`
                  : 'Is query ke liye photos nahi mili.',
              photos,
            });
          } else {
            const locationZone = (route.data as { timezone?: string }).timezone;
            liveToolData = JSON.stringify(route.data);
            liveNowInfo = describeNow(locationZone);
            agentReply = await askSpecialistAgent(
              agentId,
              `${lastUserText}\n\n${liveNowInfo}\nLive data from the ${route.toolId} tool (answer only from this data, do not guess). Present the values as the current conditions for the current time shown above — do NOT mention any observation time, reading time, or that the data may be outdated. Sunrise and sunset fields are for the current local date — if they have already passed, do not call them "tomorrow":\n${liveToolData}`,
              chatId,
              userTurn,
              selectedMode,
              requestType,
              memories,
              threadContext
            );
          }
        } else if (route?.location === 'browser' && route.toolId) {
          toolHandled = true;
          trace(`2. routing: browser tool "${route.toolId}"`);
          await runBrowserTool(currentChatIndex, route.toolId, lastUserMessage);
        } else if (agentId) {
          trace(`2. routing: selected specialist "${agentId}"`);
          setHandoff({ agentId, stage: 'delegating' });
          await wait(700);
          setHandoff({ agentId, stage: 'working' });
          const started = performance.now();
          agentReply = await askSpecialistAgent(agentId, lastUserText, chatId, userTurn, selectedMode, requestType, memories, threadContext);
          trace(`3. specialist "${agentId}" replied`, {
            ms: Math.round(performance.now() - started),
            chars: agentReply.length,
          });
          setHandoff({ agentId, stage: 'returning' });
          await wait(700);
        } else {
          trace('2. routing: no specialist (core chosen or route unavailable)');
        }
      }

      if (agentReply !== null) {
        const repliedChats: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
        const repliedMessages = repliedChats[currentChatIndex].messages;
        repliedMessages[repliedMessages.length - 1].content = agentReply;
        setChats(repliedChats);
      } else if (!toolHandled) {
        trace('3. core: POST /api/chat (streaming)', { messages: messages.length });
        const result = await timed(
          getChatCompletionStream(
            messages,
            selectedMode,
            memories,
            focus,
            chats[currentChatIndex].completionTokens,
            chats[currentChatIndex].id,
            requestType
          ),
          'The server took too long to reply. Check your connection and try again.'
        );
        stream = result.stream;
        // Server quota enforcement: the user asked for Deep but the backend
        // granted a lower tier (daily limit or global cap exhausted).
        if (selectedMode === 'deep' && result.grantedMode && result.grantedMode !== 'deep') {
          trace('3. core: requested deep but server granted', result.grantedMode);
          const usage = useUsageStore.getState();
          usage.setQuotaKind('cap');
          usage.setQuotaOpen(true);
          setError(
            `Your daily Deep limit is used up, so this reply was served by ${result.grantedMode} mode.`
          );
        }
      }

      for (let attempt = 0; stream && attempt < 2; attempt++) {
        if (stream.locked)
          throw new Error(
            'Oops, the stream is locked right now. Please try again'
          );
        const reader = stream.getReader();
        let reading = true;
        let partial = '';
        let finishReason: string | null = null;
        while (reading && useStore.getState().generating) {
          const { done, value } = await timed(
            reader.read(),
            'The reply stopped mid-stream. Check your connection and try again.'
          );
          const result = parseEventSource(
            partial + new TextDecoder().decode(value)
          );
          partial = '';

          if (result === '[DONE]' || done) {
            reading = false;
          } else {
            const resultString = result.reduce((output: string, curr) => {
              if (typeof curr === 'string') {
                partial += curr;
              } else {
                const choice = curr.choices?.[0];
                const content = choice?.delta?.content ?? null;
                if (choice?.finish_reason) finishReason = choice.finish_reason;
                if (content) output += content;
              }
              return output;
            }, '');

            const updatedChats: ChatInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );
            const updatedMessages = updatedChats[currentChatIndex].messages;
            updatedMessages[updatedMessages.length - 1].content += resultString;
            setChats(updatedChats);
            syncArtifacts(
              updatedChats[currentChatIndex].id,
              updatedMessages.length - 1,
              updatedMessages[updatedMessages.length - 1].content,
              false
            );
          }
        }
        if (finishReason) trace(`3. core: stream finished (finish_reason=${finishReason}), attempt ${attempt + 1}`);
        if (useStore.getState().generating) {
          reader.cancel('Cancelled by user').catch(() => undefined);
        } else {
          reader.cancel('Generation completed').catch(() => undefined);
        }
        reader.releaseLock();
        stream.cancel().catch(() => undefined);
        const currentBudget = useStore.getState().chats?.[currentChatIndex]?.completionTokens ?? COMPLETION_TOKENS_DEFAULT;
        if (finishReason === 'length' && attempt === 0 && currentBudget < COMPLETION_TOKENS_MAX && useStore.getState().generating) {
          const raised = Math.min(currentBudget * 2, COMPLETION_TOKENS_MAX);
          trace(`3. core: reply truncated at the token limit, regenerating with budget ${raised}`);
          const regenerated: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
          const regeneratedMessages = regenerated[currentChatIndex].messages;
          regeneratedMessages[regeneratedMessages.length - 1].content = '';
          regenerated[currentChatIndex].completionTokens = raised;
          setChats(regenerated);
          stream = (
            await timed(
              getChatCompletionStream(messages, selectedMode, memories, focus, raised, chats[currentChatIndex].id, requestType),
              'The server took too long to reply. Check your connection and try again.'
            )
          ).stream;
          continue;
        }
        if (finishReason === 'length') trace('3. core: reply still truncated at the maximum budget');
        break;
      }

      // A stream that finished cleanly with no text is an empty reply, not a lost connection.
      const emptyCheck = useStore.getState().chats?.[currentChatIndex]?.messages;
      if (useStore.getState().generating && emptyCheck && (emptyCheck[emptyCheck.length - 1]?.content ?? '').trim() === '') {
        trace('3. core: stream finished with an empty reply');
        setError('The model returned an empty answer. Please try again.');
      }

      // Voice replies are spoken from the stream, so the end of the stream is signalled
      // before any post-reply work (titles, checks) that would otherwise hold the last sentence.
      if (requestType === 'voice') useVoiceStore.getState().markReplyStreamDone();

      // finalize artifacts for the reply; the tab is only switched on completion
      const finishedNaturally = useStore.getState().generating;
      const finalChats = useStore.getState().chats;
      if (finalChats) {
        const chat = finalChats[currentChatIndex];
        const messageIndex = chat.messages.length - 1;
        syncArtifacts(
          chat.id,
          messageIndex,
          chat.messages[messageIndex].content,
          finishedNaturally
        );
      }

      if (pendingFocus) {
        summarizeThreadFocus(
          focus,
          pendingFocus.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
        )
          .then((updated) => {
            patchChat(currentChatIndex, { focus: updated, focusUpTo: droppedByWindow });
            trace('0. focus: thread facts updated after reply', updated);
          })
          .catch((err: unknown) => trace('0. focus: summary failed, keeping previous facts', (err as Error).message));
      }

      const finalMessages = useStore.getState().chats?.[currentChatIndex]?.messages ?? [];
      const finalReply = finalMessages[finalMessages.length - 1]?.content ?? '';
      if (
        finalReply !== '' &&
        !finalReply.includes('```') &&
        /[\d%$]|PKR|Rs\b|price|cost|budget|authorit|regulat|supplier|law|percent/i.test(finalReply)
      ) {
        const userStated = [
          threadMessages
            .filter((m) => m.role === 'user')
            .map((m) => m.content)
            .join('\n'),
          liveToolData ? `Live tool data fetched this turn:\n${liveToolData}` : '',
          liveNowInfo ? `Current time provided to the assistant this turn:\n${liveNowInfo}` : '',
        ]
          .filter(Boolean)
          .join('\n\n');
        verifyReplyText(finalReply, focus, userStated)
          .then((checked) => {
            if (checked.flagged === 0 || checked.corrected === finalReply) {
              trace('4. verify: reply grounded');
              return;
            }
            const next: ChatInterface[] = JSON.parse(JSON.stringify(useStore.getState().chats));
            const msgs = next[currentChatIndex].messages;
            if (msgs[msgs.length - 1].content === finalReply) {
              msgs[msgs.length - 1].content = checked.corrected;
              setChats(next);
              trace(`4. verify: ${checked.flagged} unverified span(s) marked [Verify Local Data]`);
            }
          })
          .catch((err: unknown) =>
            trace('4. verify: check failed, keeping reply', (err as Error).message)
          );
      }

      // update tokens used in chatting
      const currChats = useStore.getState().chats;
      const countTotalTokens = useStore.getState().countTotalTokens;

      if (currChats && countTotalTokens) {
        const model = currChats[currentChatIndex].config.model;
        const messages = currChats[currentChatIndex].messages;
        updateTotalTokenUsed(
          model,
          messages.slice(0, -1),
          messages[messages.length - 1]
        );
      }

      // generate title for new chats
      if (
        useStore.getState().autoTitle &&
        currChats &&
        !currChats[currentChatIndex]?.titleSet
      ) {
        const messages_length = currChats[currentChatIndex].messages.length;
        const assistant_message =
          currChats[currentChatIndex].messages[messages_length - 1].content;
        const user_message =
          currChats[currentChatIndex].messages[messages_length - 2].content;

        const message: MessageInterface = {
          role: 'user',
          content: `Generate a title in less than 6 words for the following message (language: ${i18n.language}):\n"""\nUser: ${user_message}\nAssistant: ${assistant_message}\n"""`,
        };

        // Not awaited: the title is a separate LLM call and must not delay the end of the reply.
        void generateTitle([message])
          .then((generated) => {
            let title = generated.trim();
            if (title.startsWith('"') && title.endsWith('"')) {
              title = title.slice(1, -1);
            }
            const updatedChats: ChatInterface[] = JSON.parse(
              JSON.stringify(useStore.getState().chats)
            );
            updatedChats[currentChatIndex].title = title;
            updatedChats[currentChatIndex].titleSet = true;
            setChats(updatedChats);

            // update tokens used for generating title
            if (countTotalTokens) {
              const model = _defaultChatConfig.model;
              updateTotalTokenUsed(model, [message], {
                role: 'assistant',
                content: title,
              });
            }
          })
          .catch((err: unknown) => trace('title: generation failed, keeping default title', (err as Error).message));
      }
    } catch (e: unknown) {
      const err = (e as Error).message;
      if ((e as Error).name === 'AbortError') {
        logger.debug('generation aborted');
      } else {
        if (e instanceof TypeError) {
          logger.warn('network error:', err);
          setError('Connection to Pico was lost while generating. Check your network and try again.');
        } else {
          logger.error('chat submit failed:', err);
          if (err.includes('QUOTA_EXHAUSTED') || err.includes('Rate limited!')) {
            let dismissedRecently = false;
            try {
              const at = Number(localStorage.getItem('pico_quota_modal_dismissed_at') ?? 0);
              dismissedRecently = Date.now() - at < 7 * 24 * 60 * 60 * 1000;
            } catch {
              dismissedRecently = false;
            }
            const usage = useUsageStore.getState();
            const kind = err.includes('Rate limited') ? 'busy' : 'cap';
            usage.setQuotaKind(kind);
            if (!dismissedRecently) {
              usage.setQuotaOpen(true);
            } else {
              setError(
                kind === 'busy'
                  ? 'Service is busy right now — try again in a moment.'
                  : 'Daily usage limit reached. It resets tomorrow — invite friends from Settings to earn more.'
              );
            }
          } else {
            setError(err);
          }
        }
      }
    }
    useStore.getState().setHandoff(null);
    setGenerating(false);
  };

  return { handleSubmit, error };
};

export default useSubmit;
