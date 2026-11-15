import { completionTokenLimits, replyLanguageRule, systemPrompt } from './config.js';
import { attemptModel, isFallbackStatus } from './llmClient.js';
import { modelsForMode } from './routing.js';
import { agentPersonas } from './personas.js';
import { findEmergency } from './emergency.js';
import { recentAgentMessages, saveAgentMessages } from './agentStore.js';
import { logger } from './logger.js';
import { externalTools, toolsForExtensions } from './toolRegistry.js';
import { matchAgentRules, ROUTER_CONFIDENCE_THRESHOLD } from './routingRules.js';
import { withMemory } from './memory.js';
import { mergeGroundedFacts, sanitizeFocus, sanitizeThreadMessages, withThread } from './threadContext.js';
import { applyVerificationSpans, parseVerificationSpans, shouldVerifyReply } from './verify.js';

const HISTORY_LIMIT = 10;

export const specialistDescriptions = {
  study: 'school or college topics, explanations, lesson plans, quizzes, science and chemistry facts',
  doctor: 'health symptoms, general medicine and wellbeing questions (not emergencies)',
  business: 'pricing, freelance rates, money and tax basics, invoices, barcodes, QR codes, small shop work',
  career: 'CV, cover letters, formal or job emails, interview prep, Roman Urdu text clean-up, writing prompts',
  hacker: 'programming, developer tools, JSON, regex, SQL, XML, debugging code, unit conversion',
  creative: 'design ideas, colors, logos, images, stock photos, creative writing',
  office: 'documents, letters, reports, PDF and office paperwork',
  lock_in: 'productivity, focus, study routine, motivation, time management, reminders',
  live: 'current weather, time zones, currency rates, latest live information',
};

const callLlm = async (messages, models, signal, overrides = {}) => {
  let lastError;
  for (const candidate of models) {
    if (signal?.aborted) break;
    try {
      const upstream = await attemptModel(candidate, { ...overrides, messages, stream: false }, signal);
      if (isFallbackStatus(upstream.status)) {
        lastError = new Error(`LLM request failed (${upstream.status})`);
        continue;
      }
      if (!upstream.ok) {
        logger.warn(`model ${candidate} rejected the request with status ${upstream.status}`);
        lastError = new Error(`LLM request failed (${upstream.status})`);
        continue;
      }
      const data = await upstream.json();
      const firstChoice = data.choices?.[0];
      if (firstChoice?.error) {
        logger.warn(`model ${candidate} choice error: ${firstChoice.error.message}`);
        continue;
      }
      const content = firstChoice?.message?.content;
      if (typeof content === 'string' && content.trim() !== '') {
        if (firstChoice.finish_reason === 'length') {
          if (overrides.max_tokens && overrides.max_tokens < completionTokenLimits.max) {
            const nextBudget = Math.min(overrides.max_tokens * 2, completionTokenLimits.max);
            logger.warn(`model ${candidate} hit max_tokens=${overrides.max_tokens}, retrying with ${nextBudget}`);
            const longer = await callLlm(messages, [candidate], signal, { ...overrides, max_tokens: nextBudget }).catch(() => '');
            if (longer.trim() !== '') return longer;
          }
          logger.warn(`model ${candidate} stopped at the length limit; reply may be truncated`);
        }
        return content;
      }
      const reasoning = firstChoice?.message?.reasoning;
      const jsonFromReasoning = typeof reasoning === 'string' ? reasoning.match(/\{[\s\S]*?\}/)?.[0] : null;
      if (jsonFromReasoning) {
        return jsonFromReasoning;
      }
    } catch (err) {
      lastError = err;
    }
  }
  if (lastError) throw lastError;
  return '';
};

const CLASSIFIER_TIMEOUT_MS = Number(process.env.ROUTER_CLASSIFIER_TIMEOUT_MS) || 4000;
// Doctor and Studio are planned and must never be routed to: health questions
// and planned-agent requests stay in core chat. The classifier allowlist is the
// rule-layer agent set, so a crafted reply can only pick a real live agent.
const ROUTABLE_IDS = Object.keys(specialistDescriptions).filter((id) => id !== 'doctor');

const logRoute = (message, stage, agentId, confidence, startedAt) => {
  const msgRef = typeof message === 'string' ? message.slice(0, 20) : '';
  logger.debug(
    `router stage=${stage} agent=${agentId ?? 'core'} confidence=${confidence ?? '-'} ` +
      `latencyMs=${Date.now() - startedAt} msg="${msgRef}"`
  );
};

export const routeMessage = async (message, { signal, focus, recent, sticky = null }) => {
  const startedAt = Date.now();
  const stickyId = Object.hasOwn(specialistDescriptions, sticky) && sticky !== 'doctor' ? sticky : null;

  // Stage 1: deterministic rule layer (EN / Urdu script / Roman Urdu), ~0 ms.
  const rule = matchAgentRules(message);
  if (rule) {
    logRoute(message, 'rule', rule.agentId, rule.confidence, startedAt);
    return rule.agentId;
  }

  // Stage 2: cheap JSON classifier for ambiguous text. Strict allowlist,
  // confidence threshold, and a hard timeout — any failure falls back to the
  // sticky agent or core chat.
  const options = ROUTABLE_IDS.map((id) => `- ${id}: ${specialistDescriptions[id]}`).join('\n');
  const routerPrompt =
    'You route messages for Pico. Choose the single best specialist for the user message, ' +
    'or "core" if general chat is enough. Choose a specialist only when it clearly fits. ' +
    'General questions, coding help, and writing tasks that are not a specialist tool request stay "core". ' +
    `Specialists:\n${options}\n` +
    'Reply with ONLY a JSON object: {"agentId":"<id or core>","confidence":<0..1>}. ' +
    'confidence is your certainty that the specialist clearly fits; use core when unsure.' +
    (stickyId
      ? `\nThe thread is currently with the "${stickyId}" specialist. Keep "${stickyId}" unless the new message clearly belongs to a different specialist's domain. Short follow-ups, confirmations, and questions on the same topic stay with "${stickyId}".`
      : '');

  let classifierSignal = signal;
  try {
    if (typeof AbortSignal.any === 'function' && signal) {
      classifierSignal = AbortSignal.any([signal, AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS)]);
    } else {
      classifierSignal = AbortSignal.timeout(CLASSIFIER_TIMEOUT_MS);
    }
  } catch {
    classifierSignal = signal;
  }

  let reply = '';
  try {
    reply = await callLlm(
      [
        { role: 'system', content: withThread(routerPrompt, focus, recent) },
        { role: 'user', content: message },
      ],
      modelsForMode('quick'),
      classifierSignal,
      { temperature: 0, max_tokens: 60 }
    );
  } catch (err) {
    logger.warn(`router classifier failed, using core: ${err.message}`);
    logRoute(message, 'fallback', null, 0, startedAt);
    return null;
  }

  let selected = null;
  let confidence = 0;
  try {
    const parsed = JSON.parse(reply.match(/\{[\s\S]*\}/)?.[0] ?? '');
    const id = String(parsed?.agentId ?? '').toLowerCase().replace(/[^a-z_]/g, '');
    confidence = Number(parsed?.confidence);
    if (Number.isFinite(confidence) && ROUTABLE_IDS.includes(id) && confidence >= ROUTER_CONFIDENCE_THRESHOLD) {
      selected = id;
    }
  } catch {
    // Non-JSON classifier output is treated as core (legacy replies were bare ids).
    const id = reply.trim().toLowerCase().replace(/[^a-z_]/g, '');
    if (ROUTABLE_IDS.includes(id)) {
      selected = id;
      confidence = 1;
    }
  }
  const chosen = selected ?? stickyId;
  logRoute(message, selected ? 'classifier' : stickyId ? 'sticky' : 'core', chosen, confidence, startedAt);
  return chosen;
};

const toolCatalog = externalTools
  .map((tool) => `- ${tool.id} ${tool.params}: ${tool.description}`)
  .join('\n');

export const summarizeThread = async (previous, messages, { signal }) => {
  const userMessages = sanitizeThreadMessages(messages, 20).filter((m) => m.role === 'user');
  const userText = userMessages.map((m) => m.content).join('\n');
  const transcript = userMessages.map((m) => `user: ${m.content}`).join('\n');
  if (transcript === '') return sanitizeFocus(previous);
  const prompt =
    'You maintain the structured fact sheet of a chat thread. Output ONLY a JSON object with these keys: ' +
    '"current_goal" (string: the user\'s overall goal), ' +
    '"product_focus" (string: the product, business, or topic in focus), ' +
    '"pricing_tiers" (array of strings such as "250 g: PKR 280"), ' +
    '"key_decisions" (array of strings: decisions and hard facts such as names, numbers, and choices). ' +
    'Record ONLY facts the USER explicitly stated in the new user messages. Never record numbers, prices, budgets, costs, targets, or conclusions that came from the assistant. ' +
    'Do not copy the previous sheet; output only new user-stated facts. If the user gave no figure, leave the list empty. Keep the language of the thread.';
  const reply = await callLlm(
    [
      { role: 'system', content: prompt },
      { role: 'user', content: `Previous sheet: ${sanitizeFocus(previous) || '{}'}\n\nNew messages:\n${transcript}` },
    ],
    modelsForMode('quick'),
    signal,
    { temperature: 0, top_p: 1 }
  );
  const { facts, rejected } = mergeGroundedFacts(previous, reply, userText);
  if (rejected > 0) {
    logger.warn(`thread facts: ${rejected} figure(s) not stated by the user rejected (is_assistant_generated: true)`);
  }
  return facts;
};

export const verifyReply = async (reply, { focus = '', userText = '', signal }) => {
  if (!shouldVerifyReply(reply)) return { corrected: typeof reply === 'string' ? reply : '', flagged: 0 };
  const prompt =
    'You are Pico\'s fact checker. Compare the REPLY against the USER-STATED TEXT and the FACT SHEET. ' +
    'A span is UNGROUNDED when it: (1) states a number, price, budget, percentage, or statistic that is not in the user-stated text or the fact sheet and is not a direct arithmetic result of them; ' +
    '(2) names a specific company, supplier, brand, regulator, government body, certification, or law the user did not name; ' +
    'or (3) quotes market data, exchange rates, or statistics from memory. ' +
    'Arithmetic results of allowed figures are GROUNDED (for example, 5715 packs when the user stated 200,000 and 35). ' +
    'Output ONLY JSON: {"ungrounded":["<span>",...]}. Copy each span character-for-character from the reply and keep it as short as possible. If everything is grounded, output {"ungrounded":[]}.';
  const check = await callLlm(
    [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: `USER-STATED TEXT:\n${userText.slice(0, 4000)}\n\nFACT SHEET:\n${sanitizeFocus(focus) || '{}'}\n\nREPLY:\n${reply}`,
      },
    ],
    modelsForMode('quick'),
    signal,
    { temperature: 0, top_p: 1 }
  );
  const { corrected, flagged } = applyVerificationSpans(reply, parseVerificationSpans(check));
  if (flagged > 0) logger.warn(`reply verification: ${flagged} ungrounded span(s) replaced with [Verify Local Data]`);
  return { corrected, flagged };
};

export const planDataTool = async (message, { signal }) => {
  const prompt =
    `You classify queries for live data APIs:\n${toolCatalog}\n` +
    'When the user asks for real-time or factual data matching an API, pick that id and extract params.\n' +
    'Pick a tool ONLY when the message clearly asks for that kind of data — never infer one from context alone.\n' +
    'If no API matches (general question, greeting, coding, chat, creative or document requests), pick "none".\n' +
    'Output ONLY valid JSON: {"toolId":"<id or none>","params":{...}}';

  const reply = await callLlm(
    [
      { role: 'system', content: prompt },
      { role: 'user', content: message },
    ],
    modelsForMode('quick'),
    signal,
    { temperature: 0, top_p: 1 }
  );
  const json = reply.match(/\{[\s\S]*\}/)?.[0];
  if (!json) {
    logger.warn(`tool plan has no JSON, raw reply: "${reply.trim()}"`);
    return null;
  }
  const { toolId, params = {} } = JSON.parse(json);
  if (!externalTools.some((tool) => tool.id === toolId)) {
    logger.debug(`tool plan chose "${toolId}", no external tool matched`);
    return null;
  }
  logger.debug(`tool plan: ${toolId} ${JSON.stringify(params)}`);
  return { toolId, params };
};

export const routeAttachment = async (message, extensions, { signal }) => {
  const candidates = toolsForExtensions(extensions);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0];

  const catalog = JSON.stringify(candidates.map(({ id, description }) => ({ id, description })));
  const reply = await callLlm(
    [
      {
        role: 'system',
        content:
          `Attached file types: ${extensions.join(', ')}. Pick the single tool that best matches the user request. ` +
          `Tools: ${catalog}. Reply with only JSON like {"toolId":"<id>"}.`,
      },
      { role: 'user', content: message },
    ],
    modelsForMode('quick'),
    signal
  );

  const match = reply.match(/"toolId"\s*:\s*"([a-z0-9-]+)"/i);
  const tool = candidates.find((candidate) => candidate.id === match?.[1]);
  logger.debug(`attachment router raw reply "${reply.trim()}" -> ${tool?.id ?? 'none'}`);
  if (!tool) throw new Error('Is file ke liye sahi tool tay nahi ho saka. Apni request thodi wazeh likhein.');
  return tool;
};

export const runSpecialist = async ({ userId, agentId, chatId, turn, message, memories, focus, recent, retrieved = '', mode, requestType, replyLanguage, signal }) => {
  if (agentId === 'doctor') {
    const warning = findEmergency(message);
    if (warning) return warning;
  }

  const history = await recentAgentMessages(userId, agentId, chatId, HISTORY_LIMIT);
  logger.debug(`specialist "${agentId}" history=${history.length} messages, user=${userId.slice(0, 8)}`);
  const persona = agentPersonas[agentId];
  const voiceRule =
    requestType === 'voice'
      ? '\n\nVoice mode: the user spoke this message aloud, so talk the way a warm, friendly person talks in a real conversation. Reply in Urdu by default, written in Roman Urdu (Latin letters), in 1-3 short spoken sentences. If the user writes in Urdu script, reply in Urdu script. If the user explicitly asks for Urdu (for example "Urdu mein jawab do"), reply in Urdu script. Never reply in Hindi or Devanagari script. Only reply in English if the user explicitly asks for English. Use natural everyday wording, contractions where they fit, and briefly react to what the user said so it sounds caring, not robotic. Plain conversational text only: no markdown, bullet points, headings, links, emojis, or stage directions. Write numbers, units and symbols as words, for example thirty degrees instead of 30°C, so they are easy to say aloud. If the user explicitly asks for a document, code, or an artifact, still produce the required document/code fence with full content, but keep all text outside the fence to one short spoken sentence.'
      : '';
  const system = `${withThread(withMemory(`${systemPrompt}\n\n${persona}`, memories), focus, recent)}${retrieved ? `\n\n${retrieved}` : ''}${voiceRule}${replyLanguageRule(replyLanguage)}`;
  const reply = await callLlm(
    [
      { role: 'system', content: system },
      ...history,
      { role: 'user', content: message },
    ],
    modelsForMode(mode),
    signal,
    { max_tokens: completionTokenLimits.specialist }
  );

  await saveAgentMessages(userId, agentId, chatId, turn, [
    { role: 'user', content: message },
    { role: 'assistant', content: reply },
  ]);
  return reply;
};
