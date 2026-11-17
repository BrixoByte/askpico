import express from 'express';
import { randomUUID } from 'node:crypto';
import { completionTokenLimits, guestLimits, llmConfig, replyLanguageRule, serverConfig, systemPrompt } from './config.js';
import {
  fetchWithFallback,
  sanitizeCompletion,
  sanitizeSseStream,
} from './llmClient.js';
import { logLlmCall, startProviderSync } from './aiUsage.js';
import { modelsForModeLive, publicMode } from './routing.js';
import { flagMiddleware, getFlag } from './flags.js';
import { resolveRoutingMode } from './routingService.js';
import { logger } from './logger.js';
import { compileTailwind, validateSources } from './tailwind.js';
import {
  getImageProvider,
  listConfiguredImageProviders,
} from './imageProviders/index.js';
import { agentPersonas } from './personas.js';
import { validateMemoryItems, withMemory } from './memory.js';
import { sanitizeFocus, sanitizeThreadMessages, withThread } from './threadContext.js';
import { toolAdapters } from './toolAdapters.js';
import { findEmergency } from './emergency.js';
import {
  planDataTool,
  routeAttachment,
  routeMessage,
  runSpecialist,
  specialistDescriptions,
  summarizeThread,
  verifyReply,
} from './orchestrator.js';
import { truncateAgentMessages } from './agentStore.js';
import { indexTurnMemorySafe } from './memory/vectorWorker.js';
import { formatRetrievedContext, recallContextSafe } from './memory/vectorSearch.js';
import { getUserBrain, getUserFromToken, getUserPlan, getUserTheme, saveUserBrain, saveUserTheme, supabase } from './supabase.js';
import { debitVoiceQuota } from './voiceQuota.js';
import { debitGuestVoice } from './guestVoice.js';
import {
  HEARTBEAT_SECONDS,
  dailyVoiceLimitSeconds,
  guestClaimSeconds,
  guestVoiceLimitBody,
  usesGuestVoiceTrial,
  voicePlan,
} from './voiceQuotaPolicy.js';
import { voiceTurnQuotaCheck } from './voiceTurnGate.js';
import { clientIp, hashGuestIp, hashSignal } from './guestTrialIp.js';
import { dailyTokenLimit, isDailyTokenCapReached, requestLogTokens, shouldCheckTokenCap } from './tokenQuotaPolicy.js';
import { adminRouter, getSystemFlag, getUserLimitState } from './admin/routes.js';
import { startAdminWorkers } from './workers/index.js';
import { classifyIntent } from './workers/intentClassifier.js';
import { externalTools } from './toolRegistry.js';
import {
  ATTACHMENT_MAX_BYTES,
  extractAttachmentText,
  truncateForModel,
} from './attachments.js';
import { isRateLimited, maxTextLength, synthesize, ttsStatus } from './tts.js';
import { recordHeartbeat, startVoiceProbes } from './voiceHealth.js';
import { healthSnapshot, startLocalHealthSampling } from './localHealth.js';
import { createLimiter, isSafeFileName, rateLimit, rejectIfLimited, validateChatMessages } from './security.js';

const app = express();

// Per-user limits for signed-in routes. Keys are user IDs, so a token refresh does not reset them.
const userLimits = {
  chat: createLimiter({ max: 30 }),
  agent: createLimiter({ max: 30 }),
  verify: createLimiter({ max: 30 }),
  memoryWrite: createLimiter({ max: 30 }),
  themeWrite: createLimiter({ max: 30 }),
  truncate: createLimiter({ max: 30 }),
  voice: createLimiter({ max: 20 }),
  tts: createLimiter({ max: 20 }),
  couponValidate: createLimiter({ max: 10 }),
  couponRedeem: createLimiter({ max: 5 }),
  referralClaim: createLimiter({ max: 10 }),
  accountDelete: createLimiter({ max: 3 }),
};

// Rough cost estimate per 1M tokens (flash-class models) used only for
// budget tracking in the admin panel — not billing-accurate data.
const COST_PER_MILLION_USD = { prompt: 0.3, completion: 1.2 };
const estimateTokens = (text) => Math.ceil((typeof text === 'string' ? text.length : 0) / 4);
const estimateCostUsd = (promptTokens, completionTokens) =>
  (promptTokens * COST_PER_MILLION_USD.prompt +
    completionTokens * COST_PER_MILLION_USD.completion) / 1e6;

// Fire-and-forget: telemetry must never block or fail a user request.
// log_request() also trips the circuit_breaker_active flag server-side
// once the daily budget is crossed.
const recordRequest = ({ userId, mode, feature, promptTokens, completionTokens, intentTag = null }) => {
  // Voice turns are billed in voice seconds: the request_logs row and real cost
  // still land, but p_tokens stays 0 so tokens_used_today only grows on text.
  const counted = requestLogTokens(feature, promptTokens, completionTokens);
  supabase
    .rpc('log_request', {
      p_user_id: userId,
      p_mode: mode ?? null,
      p_feature: feature,
      p_prompt_tokens: counted.promptTokens,
      p_completion_tokens: counted.completionTokens,
      p_cost_usd: estimateCostUsd(promptTokens, completionTokens),
      p_intent_tag: intentTag,
    })
    .then(({ error }) => {
      if (error) logger.warn(`request telemetry failed: ${error.message}`);
    })
    .catch((err) => logger.warn(`request telemetry failed: ${err.message}`));
};

const clampCompletionTokens = (value) =>
  Number.isInteger(value) && value > 0 ? Math.min(value, completionTokenLimits.max) : undefined;

const defaultJson = express.json({ limit: '2mb' });
app.use((req, res, next) =>
  req.path === '/api/artifact/submission' || req.path === '/api/attachments/extract'
    ? next()
    : defaultJson(req, res, next)
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  if (origin && serverConfig.corsOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Unified admin panel API (role-checked inside).
app.use('/api/admin', adminRouter);
// Live flags: 503 on every user-facing route while global_kill_switch or
// maintenance_mode is on. Admin + health stay reachable (exempt inside).
app.use(flagMiddleware);

// Public health probe — uptime, process memory, and event-loop lag. The admin
// panel polls it directly too, so health stays visible even when the Railway
// API is down. Exempt from the kill switch by the flagMiddleware regex.
app.get('/api/health', (_req, res) => {
  const s = healthSnapshot();
  res.json({
    ok: true,
    ts: s.ts,
    uptimeSec: s.uptimeSec,
    memoryMb: {
      rss: Math.round(s.memory.rss / 1024 / 1024),
      heapUsed: Math.round(s.memory.heapUsed / 1024 / 1024),
      heapTotal: Math.round(s.memory.heapTotal / 1024 / 1024),
    },
    eventLoopLagMs: s.lagMs,
  });
});

app.post('/api/chat', rateLimit({ max: 30 }), async (req, res) => {
  const { messages, stream = false, mode: requestedMode, requestType, replyLanguage, agentId, memories, focus, maxTokens, chatId } = req.body ?? {};

  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const elapsed = () => `${Date.now() - startedAt}ms`;

  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.chat, user.id, res)) return;
  const invalidMessages = validateChatMessages(messages);
  if (invalidMessages) {
    console.warn(`[${requestId}] rejected: ${invalidMessages}`);
    return res.status(400).json({ error: invalidMessages });
  }
  try {
    const plan = await getUserPlan(user.id);
    const { data: tokensToday, error: tokensErr } = await supabase.rpc('roll_daily_tokens', { p_user_id: user.id });
    if (tokensErr) throw new Error(tokensErr.message);
    if (shouldCheckTokenCap(requestType) && isDailyTokenCapReached(plan, Number(tokensToday ?? 0))) {
      return res.status(429).json({
        error: 'QUOTA_EXHAUSTED',
        message: 'Daily token limit reached. Upgrade or share your referral link to keep chatting today.',
        tokensUsed: Number(tokensToday ?? 0),
        tokenLimit: dailyTokenLimit(plan),
      });
    }
  } catch (err) {
    console.error(`[${requestId}] token quota check failed: ${err.message}`);
    return res.status(502).json({ error: 'Usage could not be checked. Please try again.' });
  }

  if (requestType === 'voice' && (await blockVoiceTurnOverQuota(res, user, requestId, 'chat', req))) return;

  // Admin kill switch + per-user enforcement (ban / throttle cap).
  try {
    if (await getSystemFlag('llm_requests_paused')) {
      return res.status(503).json({ error: 'Pico is temporarily paused by an administrator. Try again shortly.' });
    }
    if (await getSystemFlag('circuit_breaker_active')) {
      return res.status(503).json({ error: 'Daily budget reached. Pico resumes after midnight UTC.' });
    }
    const limits = await getUserLimitState(user.id);
    if (limits.status === 'banned') {
      return res.status(403).json({ error: 'Your account has been suspended. Contact support.' });
    }
    if (
      limits.status === 'throttled' &&
      limits.dailyTokenCap != null &&
      limits.tokensToday >= limits.dailyTokenCap
    ) {
      return res.status(429).json({ error: 'Daily token cap reached. Your quota resets at midnight UTC.' });
    }
    if (user.is_anonymous && (await countGuestMessagesToday(user.id)) >= guestLimits.dailyMessages) {
      return res.status(429).json({ error: 'Free guest limit reached for today. Sign in to keep chatting.' });
    }
    // Live admin cap: daily_request_cap_per_user (0 = unlimited).
    const dailyCap = await getFlag('daily_request_cap_per_user', 0);
    if (Number.isFinite(dailyCap) && dailyCap > 0 && (await countGuestMessagesToday(user.id)) >= dailyCap) {
      return res.status(429).json({ error: 'Daily request cap reached. Your quota resets at midnight UTC.' });
    }
  } catch (err) {
    logger.warn(`[${requestId}] enforcement check failed, allowing request: ${err.message}`);
  }

  if (!llmConfig.apiKey) {
    console.error(`[${requestId}] rejected: ${llmConfig.keyName} is not set`);
    return res.status(500).json({ error: `${llmConfig.keyName} is not set on the server` });
  }

  const lastUserText = [...messages].reverse().find((m) => m.role === 'user')?.content;
  const recall = recallContextSafe({
    userId: user.id,
    query: typeof lastUserText === 'string' ? lastUserText : '',
  });
  let mode;
  try {
    mode = await resolveRoutingMode({
      userId: user.id,
      requested: requestedMode,
      requestType,
      message: typeof lastUserText === 'string' ? lastUserText : '',
    });
  } catch (err) {
    console.error(`[${requestId}] routing failed: ${err.message}`);
    return res.status(502).json({ error: 'Routing is unavailable. Please try again.' });
  }
  const retrieved = formatRetrievedContext(await recall);
  const memoryChatId = typeof chatId === 'string' && CHAT_ID_PATTERN.test(chatId) ? chatId : 'core';
  const models = await modelsForModeLive(mode);
  logger.debug(`[${requestId}] new request: stream=${stream}, messages=${messages.length}, mode=${mode}`);

  // Lets the client see which tier actually served the request (streaming
  // responses cannot carry it in the JSON body).
  res.setHeader('x-pico-mode', publicMode(mode));
  res.setHeader('x-pico-requested-mode', typeof requestedMode === 'string' ? requestedMode : 'auto');

  const persona = Object.hasOwn(agentPersonas, agentId) ? agentPersonas[agentId] : null;
  const voiceRule =
    requestType === 'voice'
      ? '\n\nVoice mode: the user spoke this message aloud, so talk the way a warm, friendly person talks in a real conversation. Reply in Urdu by default, written in Roman Urdu (Latin letters), in 1-3 short spoken sentences. If the user writes in Urdu script, reply in Urdu script. If the user explicitly asks for Urdu (for example "Urdu mein jawab do"), reply in Urdu script. Never reply in Hindi or Devanagari script. Only reply in English if the user explicitly asks for English. Use natural everyday wording, contractions where they fit, and briefly react to what the user said so it sounds caring, not robotic. Plain conversational text only: no markdown, bullet points, headings, links, emojis, or stage directions. Write numbers, units and symbols as words, for example thirty degrees instead of 30°C, so they are easy to say aloud. If the user explicitly asks for a document, code, or an artifact, still produce the required document/code fence with full content, but keep all text outside the fence to one short spoken sentence.'
      : '';
  const baseSystem =
    withThread(withMemory(persona ? `${systemPrompt}\n\n${persona}` : systemPrompt, memories), sanitizeFocus(focus), []) +
    voiceRule +
    replyLanguageRule(replyLanguage);
  const outgoingMessages = [
    { role: 'system', content: retrieved ? `${baseSystem}\n\n${retrieved}` : baseSystem },
    ...messages.filter((m) => m.role !== 'system'),
  ];

  if (agentId === 'doctor') {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const warning = findEmergency(typeof lastUser?.content === 'string' ? lastUser.content : '');
    if (warning) {
      logger.warn(`[${requestId}] emergency keyword matched, LLM skipped`);
      if (stream) {
        const chunk = {
          id: `emergency-${requestId}`,
          object: 'chat.completion.chunk',
          created: Math.floor(Date.now() / 1000),
          model: 'emergency-filter',
          choices: [{ index: 0, delta: { role: 'assistant', content: warning }, finish_reason: 'stop' }],
        };
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        return res.end('data: [DONE]\n\n');
      }
      return res.json({
        id: `emergency-${requestId}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'emergency-filter',
        choices: [{ index: 0, message: { role: 'assistant', content: warning }, finish_reason: 'stop' }],
      });
    }
  }

  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const llmStartedAt = Date.now();
    const result = await fetchWithFallback(
      models,
      { messages: outgoingMessages, stream, max_tokens: clampCompletionTokens(maxTokens) },
      controller.signal,
      requestId
    );
    const feature = requestType === 'voice' ? 'voice' : 'text';
    if (!result.upstream) {
      logger.error(`[${requestId}] all models unavailable (status ${result.status}) after ${elapsed()}`);
      // Failed calls still go on the ledger — cost is 0 but they exist.
      logLlmCall({
        feature,
        userId: user.id,
        latencyMs: Date.now() - llmStartedAt,
        success: false,
        errorCode: `upstream_${result.status}`,
      });
      return res.status(result.status === 429 ? 429 : 503).json({ error: 'Service is busy. Please try again.', code: 'UPSTREAM_BUSY' });
    }
    const { upstream, model: servedModel } = result;
    logger.debug(`[${requestId}] response from tier "${mode}" after ${elapsed()}`);

    const intentTag = classifyIntent(typeof lastUserText === 'string' ? lastUserText : null);
    const promptEstimate = () =>
      estimateTokens(outgoingMessages.map((m) => (typeof m.content === 'string' ? m.content : '')).join(''));

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      const body = sanitizeSseStream(upstream.body, (fullText, streamUsage) => {
        indexTurnMemorySafe({ userId: user.id, chatId: memoryChatId, userText: typeof lastUserText === 'string' ? lastUserText : '', assistantText: fullText });
        // Providers that honour include_usage give real counts on the last
        // chunk; otherwise fall back to text-length estimates.
        const realUsage =
          Number.isInteger(streamUsage?.prompt_tokens) && Number.isInteger(streamUsage?.completion_tokens);
        const promptTokens = realUsage ? streamUsage.prompt_tokens : promptEstimate();
        const completionTokens = realUsage ? streamUsage.completion_tokens : estimateTokens(fullText);
        recordRequest({ userId: user.id, mode, feature, intentTag, promptTokens, completionTokens });
        logLlmCall({
          model: servedModel,
          feature,
          userId: user.id,
          promptTokens,
          completionTokens,
          latencyMs: Date.now() - llmStartedAt,
          estimated: !realUsage,
        });
      });
      body.on('error', (err) => {
        logger.warn(`[${requestId}] upstream stream failed mid-reply: ${err.message}`);
        res.destroy();
      });
      body.pipe(res);
      return;
    }

    const data = await upstream.json();
    const usage = data?.usage ?? {};
    const realPrompt = Number.isInteger(usage.prompt_tokens);
    const realCompletion = Number.isInteger(usage.completion_tokens);
    const promptTokens = realPrompt ? usage.prompt_tokens : promptEstimate();
    const completionTokens = realCompletion
      ? usage.completion_tokens
      : estimateTokens(data?.choices?.[0]?.message?.content);
    recordRequest({ userId: user.id, mode, feature, intentTag, promptTokens, completionTokens });
    logLlmCall({
      model: servedModel,
      feature,
      userId: user.id,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - llmStartedAt,
      estimated: !(realPrompt && realCompletion),
    });
    indexTurnMemorySafe({
      userId: user.id,
      chatId: memoryChatId,
      userText: typeof lastUserText === 'string' ? lastUserText : '',
      assistantText: data?.choices?.[0]?.message?.content ?? '',
    });
    res.json({
      ...sanitizeCompletion(data),
      mode: publicMode(mode),
      requestedMode: typeof requestedMode === 'string' ? requestedMode : 'auto',
    });
  } catch (err) {
    if (controller.signal.aborted) {
      logger.debug(`[${requestId}] client disconnected after ${elapsed()}`);
      return;
    }
    console.error(`[${requestId}] upstream fetch error after ${elapsed()}: ${err.message}`);
    res.status(502).json({ error: 'Service is unavailable. Please try again.' });
  }
});

app.post('/api/artifact/css', async (req, res) => {
  const sources = req.body?.sources;
  const invalid = validateSources(sources);
  if (invalid) return res.status(400).json({ error: invalid });

  try {
    const css = await compileTailwind(sources);
    res.json({ css });
  } catch (err) {
    console.error(`[artifact-css] compile failed: ${err.message}`);
    res.status(500).json({ error: 'Stylesheet could not be built. Please try again.' });
  }
});

app.get('/api/tools/:tool', rateLimit({ max: 30 }), async (req, res) => {
  const adapter = Object.hasOwn(toolAdapters, req.params.tool) ? toolAdapters[req.params.tool] : null;
  if (!adapter) return res.status(404).json({ error: 'unknown tool' });

  try {
    res.json(await adapter(req.query));
  } catch (err) {
    logger.warn(`[tool:${req.params.tool}] failed: ${err.message}`);
    res.status(502).json({ error: 'Tool request failed. Please try again.' });
  }
});

const AGENT_MESSAGE_MAX_LENGTH = 4000;
const CHAT_ID_PATTERN = /^[\w-]{1,100}$/;

const EXTENSION_PATTERN = /^\.[a-z0-9]{1,10}$/;

const requireUser = async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null;
  const user = await getUserFromToken(token);
  if (!user) {
    res.status(401).json({ error: 'sign-in session is required' });
    return null;
  }
  return user;
};

const requireSignedInUser = async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return null;
  if (user.is_anonymous) {
    res.status(403).json({ error: 'memory sync is available for signed-in accounts only' });
    return null;
  }
  return user;
};

const countGuestMessagesToday = async (userId) => {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from('request_logs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', dayStart.toISOString());
  if (error) throw new Error(`guest usage read failed: ${error.message}`);
  return count ?? 0;
};

app.get('/api/memory', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  try {
    res.json({ items: await getUserBrain(user.id) });
  } catch (err) {
    console.error(`memory read failed: ${err.message}`);
    res.status(502).json({ error: 'Memory is unavailable. Please try again.' });
  }
});

app.put('/api/memory', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.memoryWrite, user.id, res)) return;
  const items = req.body?.items;
  const problem = validateMemoryItems(items);
  if (problem) return res.status(400).json({ error: problem });
  const cleaned = items.map((item) => item.trim());
  try {
    await saveUserBrain(user.id, cleaned);
    res.json({ items: cleaned });
  } catch (err) {
    console.error(`memory save failed: ${err.message}`);
    res.status(502).json({ error: 'Memory could not be saved. Please try again.' });
  }
});

const THEME_VALUES = ['light', 'dark', 'system'];

app.get('/api/preferences/theme', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  try {
    res.json({ theme: await getUserTheme(user.id) });
  } catch (err) {
    console.error(`theme read failed: ${err.message}`);
    res.status(502).json({ error: 'Theme is unavailable. Please try again.' });
  }
});

app.put('/api/preferences/theme', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.themeWrite, user.id, res)) return;
  const theme = req.body?.theme;
  if (!THEME_VALUES.includes(theme)) return res.status(400).json({ error: 'theme must be light, dark or system' });
  try {
    await saveUserTheme(user.id, theme);
    res.json({ theme });
  } catch (err) {
    console.error(`theme save failed: ${err.message}`);
    res.status(502).json({ error: 'Theme could not be saved. Please try again.' });
  }
});

const COUPON_CODE_PATTERN = /^[A-Z0-9-]{4,32}$/i;

// Checks an early-buyer coupon without redeeming it — the code is only
// burned once the buyer's payment is confirmed manually.
app.get('/api/coupons/validate', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.couponValidate, user.id, res)) return;
  const code = String(req.query.code ?? '').trim().toUpperCase();
  if (!COUPON_CODE_PATTERN.test(code)) {
    return res.status(400).json({ status: 'invalid' });
  }
  try {
    const { data, error } = await supabase
      .from('coupons')
      .select('discount_pct, months, plan, max_redemptions, redeemed_count, expires_at')
      .eq('code', code)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return res.json({ status: 'invalid' });
    if (new Date(data.expires_at) < new Date()) return res.json({ status: 'expired' });
    if (data.redeemed_count >= data.max_redemptions) return res.json({ status: 'used' });
    res.json({
      status: 'valid',
      discountPct: data.discount_pct,
      months: data.months,
      plan: data.plan,
    });
  } catch (err) {
    console.error(`coupon check failed: ${err.message}`);
    res.status(502).json({ error: 'Coupon check is unavailable. Please try again.' });
  }
});

// Burns a one-time coupon for the signed-in user (manual activation flow).
app.post('/api/coupons/redeem', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.couponRedeem, user.id, res)) return;
  const code = String(req.body?.code ?? '').trim().toUpperCase();
  if (!COUPON_CODE_PATTERN.test(code)) {
    return res.status(400).json({ status: 'invalid' });
  }
  try {
    const { data, error } = await supabase.rpc('redeem_coupon', {
      p_user_id: user.id,
      p_code: code,
    });
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    console.error(`coupon redeem failed: ${err.message}`);
    res.status(502).json({ error: 'Coupon could not be applied. Please try again.' });
  }
});

const REFERRAL_CODE_PATTERN = /^[\w-]{3,64}$/;
const DEVICE_ID_PATTERN = /^[\w-]{8,64}$/;
// hashSignal moved to guestTrialIp.js so the guest-trial cap shares the same keyed hash.

// Links the caller to the referrer who shared the ?ref= code.
// Self and repeat referrals return their own status so the client can
// clear the stored code either way.
app.post('/api/referral/claim', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.referralClaim, user.id, res)) return;
  const code = String(req.body?.code ?? '').trim();
  if (!REFERRAL_CODE_PATTERN.test(code)) {
    return res.status(400).json({ status: 'invalid' });
  }
  const deviceId = typeof req.body?.deviceId === 'string' && DEVICE_ID_PATTERN.test(req.body.deviceId) ? req.body.deviceId : null;
  const clientIp = req.ip || req.socket?.remoteAddress || 'unknown';
  try {
    const { error: signalError } = await supabase
      .from('profiles')
      .update({
        device_fingerprint: deviceId ? hashSignal(`device:${deviceId}`) : null,
        signup_ip_hash: hashSignal(`ip:${clientIp}`),
      })
      .eq('id', user.id)
      .is('signup_ip_hash', null);
    if (signalError) throw new Error(signalError.message);
    const { data, error } = await supabase.rpc('claim_referral', {
      p_user_id: user.id,
      p_code: code,
    });
    if (error) throw new Error(error.message);
    res.json(data);
  } catch (err) {
    console.error(`referral claim failed: ${err.message}`);
    res.status(502).json({ error: 'Referral could not be recorded. Please try again.' });
  }
});

const readReferralCode = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.referral_code ?? null;
};

// Returns the caller's shareable referral code, creating it on first request.
app.get('/api/referral/code', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  try {
    const existing = await readReferralCode(user.id);
    if (existing) return res.json({ code: existing });
    const { data, error } = await supabase
      .from('profiles')
      .update({ referral_code: randomUUID().replace(/-/g, '').slice(0, 10) })
      .eq('id', user.id)
      .is('referral_code', null)
      .select('referral_code')
      .maybeSingle();
    if (error) throw new Error(error.message);
    const code = data?.referral_code ?? (await readReferralCode(user.id));
    if (!code) throw new Error('profile row missing');
    res.json({ code });
  } catch (err) {
    logger.warn(`referral code failed: ${err.message}`);
    res.status(502).json({ error: 'Referral code could not be loaded. Please try again.' });
  }
});

// Permanently deletes the caller's auth user. Profile, chats, memory and other
// per-user rows are removed by their ON DELETE CASCADE foreign keys.
app.delete('/api/account', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.accountDelete, user.id, res)) return;
  try {
    const { error } = await supabase.auth.admin.deleteUser(user.id);
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    logger.warn(`account delete failed: ${err.message}`);
    res.status(502).json({ error: 'Account could not be deleted. Please try again.' });
  }
});

// Public: called by the ?ref= landing page. Only counts valid codes; returns nothing sensitive.
app.post('/api/referral/click', async (req, res) => {
  const code = String(req.body?.code ?? '').trim();
  if (!REFERRAL_CODE_PATTERN.test(code)) return res.status(400).json({ status: 'invalid' });
  try {
    const { error } = await supabase.rpc('record_referral_click', { p_code: code });
    if (error) throw new Error(error.message);
    res.json({ ok: true });
  } catch (err) {
    logger.warn(`referral click failed: ${err.message}`);
    res.status(502).json({ error: 'Click could not be recorded.' });
  }
});

// Referral stats for the account card. Fraud flags are never returned.
app.get('/api/referral/stats', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  try {
    const [referrals, profile, clicks] = await Promise.all([
      supabase.from('referrals').select('referred_id, status').eq('referrer_id', user.id),
      supabase.from('profiles').select('bonus_voice_seconds').eq('id', user.id).maybeSingle(),
      supabase.from('referral_clicks').select('id', { count: 'exact', head: true }).eq('referrer_id', user.id),
    ]);
    const firstErr = [referrals, profile, clicks].find((r) => r.error);
    if (firstErr) throw new Error(firstErr.error.message);
    const referredIds = referrals.data.map((r) => r.referred_id);
    const paidIds = new Set();
    if (referredIds.length > 0) {
      const { data: subs, error: subsErr } = await supabase
        .from('subscriptions')
        .select('user_id, plan, expires_at')
        .in('user_id', referredIds)
        .in('plan', ['weekly', 'monthly']);
      if (subsErr) throw new Error(subsErr.message);
      const now = Date.now();
      for (const s of subs ?? []) {
        if (!s.expires_at || new Date(s.expires_at).getTime() > now) paidIds.add(s.user_id);
      }
    }
    const countOf = (status) => referrals.data.filter((r) => r.status === status).length;
    res.json({
      clicks: clicks.count ?? 0,
      signups: referrals.data.length,
      freeSignups: referrals.data.filter((r) => !paidIds.has(r.referred_id)).length,
      paidUpgrades: referrals.data.filter((r) => paidIds.has(r.referred_id)).length,
      successful: countOf('rewarded'),
      pending: countOf('pending'),
      earnedSeconds: Number(profile.data?.bonus_voice_seconds ?? 0),
    });
  } catch (err) {
    logger.warn(`referral stats failed: ${err.message}`);
    res.status(502).json({ error: 'Referral stats could not be loaded. Please try again.' });
  }
});

// Called once per voice session after the first completed reply. Counts as the
// qualifying voice activity for any pending referral reward.
app.post('/api/voice/session-complete', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.voice, user.id, res)) return;
  try {
    const { data: profile, error: readErr } = await supabase
      .from('profiles')
      .select('voice_sessions_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const { error: updErr } = await supabase
      .from('profiles')
      .update({ voice_sessions_completed: (profile?.voice_sessions_completed ?? 0) + 1 })
      .eq('id', user.id);
    if (updErr) throw new Error(updErr.message);
    const { data, error } = await supabase.rpc('complete_referral_reward', {
      p_user_id: user.id,
      p_trigger: 'voice_session',
    });
    if (error) throw new Error(error.message);
    res.json({ ok: true, referral: data?.status ?? 'none' });
  } catch (err) {
    logger.warn(`voice session complete failed: ${err.message}`);
    res.status(502).json({ error: 'Voice session could not be recorded.' });
  }
});

// Voice quota: the server is the only authority. Clients never report their own timers as truth.
// Guest voice trial: lifetime allowance, charged from the client's claimed active seconds.
// Every debit is logged with its reason so Railway logs can reconstruct a session's billing.
const handleGuestVoice = async (res, user, claimed, label, reason, ipHash) => {
  try {
    const trial = await debitGuestVoice({ client: supabase, userId: user.id, claimed, touch: true, ipHash });
    logger.info(
      `[voice-trial] ${label} user=${user.id.slice(-8)} claimed=${claimed} charged=${trial.chargedSeconds} ` +
        `used=${trial.usedSeconds} remaining=${trial.remainingSeconds} reason=${reason ?? 'n/a'}`,
    );
    if (trial.exhausted) return res.status(403).json(guestVoiceLimitBody());
    res.json({ remainingSeconds: trial.remainingSeconds, limitSeconds: trial.limitSeconds });
  } catch (err) {
    logger.warn(`${label} failed: ${err.message}`);
    res.status(502).json({ error: 'Voice trial could not be checked. Please try again.' });
  }
};

// Voice turns (chat + agent chat) share one quota gate: guests are charged against the
// lifetime trial, signed-in users get the daily-quota read-only check. Both are logged.
const blockVoiceTurnOverQuota = async (res, user, requestId, label, req) => {
  try {
    const result = await voiceTurnQuotaCheck({
      user,
      plan: usesGuestVoiceTrial(user) ? null : voicePlan(user, await getUserPlan(user.id)),
      debitGuest: ({ userId, claimed }) =>
        debitGuestVoice({ client: supabase, userId, claimed, touch: true, ipHash: hashGuestIp(clientIp(req)) }),
      debitDaily: debitVoiceQuota,
    });
    logger.info(
      `[voice-turn] ${label} user=${user.id.slice(-8)} anon=${user.is_anonymous === true} ` +
        `charged=${result.chargedSeconds ?? 0} blocked=${result.blocked}`,
    );
    if (!result.blocked) return false;
    res.status(result.status).json(result.body);
    return true;
  } catch (err) {
    console.error(`[${requestId}] voice quota check failed: ${err.message}`);
    res.status(502).json({ error: 'Voice quota could not be checked. Please try again.' });
    return true;
  }
};

// A short client-supplied label for why a heartbeat was sent (beat | pause | end).
// Logged only; it never affects billing, which stays claim + wall-clock based.
const heartbeatReason = (body) => {
  const reason = typeof body?.reason === 'string' ? body.reason : '';
  return /^[a-z_]{1,24}$/.test(reason) ? reason : 'n/a';
};

const handleVoiceQuota = (increment, label) => async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.voice, user.id, res)) return;
  if (usesGuestVoiceTrial(user)) {
    return handleGuestVoice(
      res,
      user,
      guestClaimSeconds(increment, req.body),
      label,
      heartbeatReason(req.body),
      hashGuestIp(clientIp(req)),
    );
  }
  try {
    const quota = await debitVoiceQuota({
      userId: user.id,
      plan: voicePlan(user, await getUserPlan(user.id)),
      increment,
    });
    if (quota.exhausted) {
      return res.status(403).json({
        error: 'QUOTA_EXHAUSTED',
        message: 'Daily voice limit reached. End the voice session. Upgrade or invite friends for more minutes.',
        ...quota,
      });
    }
    res.json(quota);
  } catch (err) {
    logger.warn(`${label} failed: ${err.message}`);
    res.status(502).json({ error: 'Voice quota could not be checked. Please try again.' });
  }
};

// Called before a voice session starts. Read-only: it blocks if no balance is left.
// The IP limit stops a script from opening guest sessions in bulk; a real user starts a few per minute at most.
app.post('/api/voice/session-start', rateLimit({ max: 12 }), handleVoiceQuota(0, 'voice session start'));

// Called every HEARTBEAT_SECONDS while voice mode is on. Adds the interval to the daily total
// (guests: adds the client's claimed active seconds, capped by the server's clock).
app.post('/api/voice/heartbeat', handleVoiceQuota(HEARTBEAT_SECONDS, 'voice heartbeat'));

// Guest voice balance for the sidebar row. Read-only: it never starts or extends a session.
app.get('/api/voice/trial', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!usesGuestVoiceTrial(user)) return res.json({ guest: false });
  try {
    const trial = await debitGuestVoice({ client: supabase, userId: user.id, claimed: 0, touch: false });
    res.json({ guest: true, limitSeconds: trial.limitSeconds, remainingSeconds: trial.remainingSeconds });
  } catch (err) {
    logger.warn(`voice trial read failed: ${err.message}`);
    res.status(502).json({ error: 'Voice trial could not be loaded. Please try again.' });
  }
});

// Dev-only sink for browser logs (apps/web/src/utils/logger.ts) so they print in the API server terminal.
const CLIENT_LOG_LEVELS = new Set(['debug', 'info', 'warn', 'error']);
app.post('/api/client-log', rateLimit({ max: 300 }), (req, res) => {
  if (process.env.NODE_ENV === 'production') return res.sendStatus(404);
  const { level, message } = req.body ?? {};
  if (!CLIENT_LOG_LEVELS.has(level) || typeof message !== 'string') return res.sendStatus(400);
  const line = `[client] ${message.replace(/[\r\n\u0000-\u001f]/g, ' ').slice(0, 2000)}`;
  (level === 'error' ? logger.error : level === 'warn' ? logger.warn : logger.info)(line);
  res.sendStatus(204);
});

// Account panel usage for today (UTC). Read from the profile counters, which the server maintains.
app.get('/api/usage', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const plan = await getUserPlan(user.id);
    const { data: tokensToday, error: tokensErr } = await supabase.rpc('roll_daily_tokens', { p_user_id: user.id });
    if (tokensErr) throw new Error(tokensErr.message);
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('voice_seconds_used_today, bonus_voice_seconds, is_flagged')
      .eq('id', user.id)
      .maybeSingle();
    if (profileErr) throw new Error(profileErr.message);
    const voiceLimit = dailyVoiceLimitSeconds(voicePlan(user, plan));
    const bonus = profile?.is_flagged ? 0 : Number(profile?.bonus_voice_seconds ?? 0);
    res.json({
      plan,
      tokensUsed: Number(tokensToday ?? 0),
      tokenLimit: dailyTokenLimit(plan),
      voiceUsedSeconds: Number(profile?.voice_seconds_used_today ?? 0),
      voiceLimitSeconds: voiceLimit === null ? null : voiceLimit + bonus,
      bonusVoiceSeconds: bonus,
    });
  } catch (err) {
    logger.warn(`usage read failed: ${err.message}`);
    res.status(502).json({ error: 'Usage could not be loaded. Please try again.' });
  }
});

app.post('/api/agent/route', async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.agent, user.id, res)) return;
  const { message, fileExtensions = [], focus, recent, stickyAgentId, timezone } = req.body ?? {};
  // Spoken queries are vague ("weather here", "my phone's weather") — give the
  // tool planner a place hint derived from the client's timezone.
  const placeHint =
    typeof timezone === 'string' && /^[\w/+-]{2,64}$/.test(timezone) && timezone.includes('/')
      ? timezone.split('/').pop().replace(/_/g, ' ')
      : undefined;

  if (typeof message !== 'string' || message.trim() === '' || message.length > AGENT_MESSAGE_MAX_LENGTH) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!Array.isArray(fileExtensions) || !fileExtensions.every((ext) => EXTENSION_PATTERN.test(ext))) {
    return res.status(400).json({ error: 'fileExtensions is invalid' });
  }
  if (!llmConfig.apiKey) {
    return res.status(500).json({ error: `${llmConfig.keyName} is not set on the server` });
  }

  const signal = AbortSignal.timeout(20000);
  if (fileExtensions.length > 0) {
    try {
      const tool = await routeAttachment(message, fileExtensions, { signal });
      if (tool) {
        logger.debug(`[${requestId}] attachment routed to tool ${tool.id} (${tool.location})`);
        return res.json({ agentId: tool.agent, toolId: tool.id, location: tool.location });
      }
    } catch (err) {
      logger.warn(`[${requestId}] attachment routing failed: ${err.message}`);
      return res.status(422).json({ error: err.message });
    }
  }

  try {
    const call = await planDataTool(message, { signal: AbortSignal.timeout(20000) }).catch(
      (err) => {
        logger.warn(`[${requestId}] tool planning failed: ${err.message}`);
        return null;
      }
    );
    // Spoken queries name no place ("weather here", "my phone's weather") —
    // fill the city from the device timezone, but only when the planner
    // already decided the message is a weather request.
    if (call?.toolId === 'weather' && !call.params?.city && placeHint) {
      call.params = { ...(call.params ?? {}), city: placeHint };
    }
    if (call) {
      const tool = externalTools.find((candidate) => candidate.id === call.toolId);
      if (user.is_anonymous) {
        return res.status(403).json({
          error: 'Sign in to use live data tools like weather, currency, crypto and search.',
          code: 'signin_required',
        });
      }
      try {
        const data = await toolAdapters[call.toolId](call.params);
        logger.debug(`[${requestId}] tool ${call.toolId} ok`);
        return res.json({ agentId: tool.agent, toolId: call.toolId, location: 'external', data });
      } catch (err) {
        logger.warn(`[${requestId}] tool ${call.toolId} failed: ${err.message}`);
        return res.json({
          agentId: tool.agent,
          toolId: call.toolId,
          location: 'external',
          toolError: `Live data nahi mil saka (${err.message}). Server ki API key ya connection check karein.`,
        });
      }
    }
    const agentId = await routeMessage(message, {
      signal: AbortSignal.timeout(20000),
      focus: sanitizeFocus(focus),
      recent: sanitizeThreadMessages(recent),
      sticky: stickyAgentId,
    });
    logger.debug(`[${requestId}] routed to ${agentId ?? 'core'}`);
    res.json({ agentId });
  } catch (err) {
    logger.warn(`[${requestId}] routing failed, using core: ${err.message}`);
    res.json({ agentId: null });
  }
});

app.post('/api/thread/focus', async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const user = await requireUser(req, res);
  if (!user) return;
  const { previous = '', messages } = req.body ?? {};

  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
    return res.status(400).json({ error: 'messages must be an array of 1 to 20 items' });
  }
  if (!llmConfig.apiKey) {
    return res.status(500).json({ error: `${llmConfig.keyName} is not set on the server` });
  }

  try {
    const focus = await summarizeThread(previous, messages, { signal: AbortSignal.timeout(20000) });
    res.json({ focus });
  } catch (err) {
    logger.warn(`[${requestId}] thread focus failed: ${err.message}`);
    res.status(502).json({ error: 'Could not update the thread summary.' });
  }
});

// Post-generation fact check: marks ungrounded spans in a reply.
// Failures return the original reply so the client can continue.
app.post('/api/chat/verify', async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.verify, user.id, res)) return;
  const { reply, focus, userText } = req.body ?? {};
  if (typeof reply !== 'string' || reply.trim() === '') {
    return res.status(400).json({ error: 'reply is required' });
  }
  if (!llmConfig.apiKey) {
    return res.json({ corrected: reply, flagged: 0 });
  }
  try {
    const result = await verifyReply(reply, {
      focus: sanitizeFocus(focus),
      userText: typeof userText === 'string' ? userText.slice(0, 8000) : '',
      signal: AbortSignal.timeout(20000),
    });
    logger.debug(`[${requestId}] reply verified, ${result.flagged} span(s) flagged`);
    res.json(result);
  } catch (err) {
    logger.warn(`[${requestId}] reply verification failed, keeping original: ${err.message}`);
    res.json({ corrected: reply, flagged: 0 });
  }
});

app.post('/api/agent/chat', async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.agent, user.id, res)) return;
  const { agentId, chatId, turn, message, mode: requestedMode, requestType, replyLanguage, memories, focus, recent } = req.body ?? {};

  if (requestType === 'voice' && (await blockVoiceTurnOverQuota(res, user, requestId, 'agent', req))) return;

  if (typeof chatId !== 'string' || !CHAT_ID_PATTERN.test(chatId)) {
    return res.status(400).json({ error: 'chatId is required' });
  }
  if (!Number.isInteger(turn) || turn < 0) {
    return res.status(400).json({ error: 'turn is required' });
  }
  if (!Object.hasOwn(specialistDescriptions, agentId)) {
    return res.status(400).json({ error: 'unknown agentId' });
  }
  if (typeof message !== 'string' || message.trim() === '' || message.length > AGENT_MESSAGE_MAX_LENGTH) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (!llmConfig.apiKey) {
    return res.status(500).json({ error: `${llmConfig.keyName} is not set on the server` });
  }

  try {
    const [retrievedMatches, mode] = await Promise.all([
      recallContextSafe({ userId: user.id, query: message }),
      resolveRoutingMode({ userId: user.id, requested: requestedMode, requestType, message }),
    ]);
    const reply = await runSpecialist({
      userId: user.id,
      agentId,
      chatId,
      turn,
      message,
      memories,
      focus: sanitizeFocus(focus),
      recent: sanitizeThreadMessages(recent),
      retrieved: formatRetrievedContext(retrievedMatches),
      mode,
      requestType,
      replyLanguage,
      signal: AbortSignal.timeout(60000),
    });
    indexTurnMemorySafe({ userId: user.id, chatId, userText: message, assistantText: reply });
    recordRequest({
      userId: user.id,
      mode,
      feature: 'agent',
      intentTag: classifyIntent(message),
      promptTokens: estimateTokens(message),
      completionTokens: estimateTokens(reply),
    });
    res.json({ agentId, reply });
  } catch (err) {
    console.error(`[${requestId}] specialist ${agentId} failed: ${err.message}`);
    res.status(502).json({ error: 'Agent request failed. Please try again.' });
  }
});

app.post('/api/agent/truncate', async (req, res) => {
  const user = await requireUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.truncate, user.id, res)) return;
  const { chatId, fromTurn } = req.body ?? {};

  if (typeof chatId !== 'string' || !CHAT_ID_PATTERN.test(chatId)) {
    return res.status(400).json({ error: 'chatId is required' });
  }
  if (!Number.isInteger(fromTurn) || fromTurn < 0) {
    return res.status(400).json({ error: 'fromTurn is required' });
  }

  try {
    await truncateAgentMessages(user.id, chatId, fromTurn);
    res.json({ ok: true });
  } catch (err) {
    console.error(`history truncate failed: ${err.message}`);
    res.status(500).json({ error: 'history cleanup failed' });
  }
});

app.post(
  '/api/attachments/extract',
  rateLimit({ max: 20 }),
  express.json({ limit: '15mb' }),
  async (req, res) => {
    const requestId = randomUUID().slice(0, 8);
    if (!(await requireSignedInUser(req, res))) return;
    const { name, dataBase64 } = req.body ?? {};

    if (typeof name !== 'string' || name.trim() === '' || name.length > 255) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (typeof dataBase64 !== 'string' || dataBase64 === '') {
      return res.status(400).json({ error: 'dataBase64 is required' });
    }

    if (!isSafeFileName(name)) {
      return res.status(400).json({ error: 'file name is not valid' });
    }

    const buffer = Buffer.from(dataBase64, 'base64');
    if (buffer.length === 0 || buffer.length > ATTACHMENT_MAX_BYTES) {
      return res.status(400).json({ error: 'file size must be between 1 byte and 10 MB' });
    }

    try {
      const text = truncateForModel(await extractAttachmentText(name, buffer));
      res.json({ text });
    } catch (err) {
      logger.warn(`[${requestId}] attachment extract failed: ${err.message}`);
      res.status(422).json({ error: err.message });
    }
  }
);

const SUSPICIOUS_PATTERNS = ['<script', '</script', 'onerror=', 'onload=', 'javascript:', 'document.cookie', 'localstorage', 'sessionstorage', 'eval(', 'fetch(', 'new function', '<iframe'];
const SUBMISSION_MAX_KEYS = 50;
const SUBMISSION_MAX_VALUE_LENGTH = 2000;
const ARTIFACT_ID_PATTERN = /^[\w.-]{1,200}$/;

app.post('/api/artifact/submission', rateLimit({ max: 30 }), express.json({ limit: '16kb' }), (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const { artifactId, fields } = req.body ?? {};

  if (typeof artifactId !== 'string' || !ARTIFACT_ID_PATTERN.test(artifactId)) {
    return res.status(400).json({ error: 'artifactId is required' });
  }
  const isObject = fields !== null && typeof fields === 'object' && !Array.isArray(fields);
  if (!isObject || Object.keys(fields).length > SUBMISSION_MAX_KEYS) {
    return res.status(400).json({ error: 'fields must be an object with at most 50 keys' });
  }
  const values = Object.values(fields);
  if (values.some((value) => typeof value !== 'string' || value.length > SUBMISSION_MAX_VALUE_LENGTH)) {
    return res.status(400).json({ error: 'each field must be a string of at most 2000 characters' });
  }

  const lowered = values.map((value) => value.toLowerCase());
  const flags = SUSPICIOUS_PATTERNS.filter((pattern) => lowered.some((value) => value.includes(pattern)));

  if (flags.length > 0) {
    logger.warn(
      `[${requestId}] SUSPICIOUS submission artifact=${artifactId} flags=${flags.join(',')} fields=${JSON.stringify(Object.keys(fields))}`
    );
    return res.status(422).json({ error: 'rejected' });
  }

  logger.warn(
    `[${requestId}] submission artifact=${artifactId} fields=${JSON.stringify(Object.keys(fields))}`
  );
  res.json({ ok: true });
});

const IMAGE_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const IMAGE_PROMPT_MAX_LENGTH = 1000;
const IMAGE_RATE_WINDOW_MS = 60000;
const IMAGE_RATE_MAX_REQUESTS = 10;

// In-memory limiter: per process only. Use a shared store (e.g. Redis) when running multiple instances.
const imageRequestLog = new Map();

const allowImageRequest = (ip) => {
  const now = Date.now();
  const recent = (imageRequestLog.get(ip) ?? []).filter((t) => now - t < IMAGE_RATE_WINDOW_MS);
  if (recent.length >= IMAGE_RATE_MAX_REQUESTS) {
    imageRequestLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  imageRequestLog.set(ip, recent);
  return true;
};

setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of imageRequestLog) {
    if (times.every((t) => now - t >= IMAGE_RATE_WINDOW_MS)) imageRequestLog.delete(ip);
  }
}, IMAGE_RATE_WINDOW_MS).unref();

// ── TTS (voice mode Step 4) ────────────────────────────────────────────────
// Provider chain lives in tts.js; guests may use it (voice works for guest
// sessions) so auth is optional and abuse is bounded by a per-IP rate limit.

app.get('/api/tts/status', (_req, res) => {
  res.json(ttsStatus());
});

// Laptop TTS machine posts here every ~30s: curl -X POST /api/tts/heartbeat
//   -H "x-pico-heartbeat: $TTS_HEARTBEAT_SECRET" -d '{"meta":{...}}'
// No auth user is involved — the shared secret is the credential. Sleep, IP
// changes, and tunnel drops all just delay the next post; last_seen is what
// the health page reads.
const HEARTBEAT_SECRET = process.env.TTS_HEARTBEAT_SECRET || '';
app.post('/api/tts/heartbeat', express.json({ limit: '8kb' }), async (req, res) => {
  if (!HEARTBEAT_SECRET || req.headers['x-pico-heartbeat'] !== HEARTBEAT_SECRET) {
    return res.status(403).json({ error: 'forbidden' });
  }
  const meta = req.body && typeof req.body === 'object' ? req.body.meta : null;
  const ok = await recordHeartbeat(meta && typeof meta === 'object' ? meta : {});
  res.status(ok ? 200 : 502).json({ ok });
});

app.post('/api/tts', async (req, res) => {
  const user = await requireSignedInUser(req, res);
  if (!user) return;
  if (rejectIfLimited(userLimits.tts, user.id, res)) return;
  const text = typeof req.body?.text === 'string' ? req.body.text.trim() : '';
  if (text === '') return res.status(400).json({ error: 'text is required' });
  if (text.length > maxTextLength) {
    return res.status(400).json({ error: `text exceeds ${maxTextLength} characters` });
  }

  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Too many voice requests. Try again in a minute.' });
  }

  const lang = /^[a-z]{2,3}(-[a-zA-Z0-9]{2,8}){0,2}$/i.test(req.body?.lang ?? '')
    ? req.body.lang
    : undefined;

  const result = await synthesize(text, lang, { userId: user.id });
  if (!result) {
    // Client falls back to browser speechSynthesis — voice never goes silent.
    return res.status(503).json({ error: 'tts_unavailable' });
  }

  res.setHeader('Content-Type', result.contentType);
  res.setHeader('X-TTS-Provider', result.provider);
  res.setHeader('Cache-Control', 'no-store');
  result.stream.on('error', (err) => {
    logger.warn(`tts: stream error (${result.provider}): ${err.message}`);
    if (!res.headersSent) res.status(502).end();
    else res.destroy();
  });
  result.stream.pipe(res);
});

app.get('/api/image/providers', (req, res) => {
  res.json({ providers: listConfiguredImageProviders() });
});

app.post('/api/image/generate', async (req, res) => {
  const requestId = randomUUID().slice(0, 8);
  const startedAt = Date.now();
  const elapsed = () => `${Date.now() - startedAt}ms`;
  const imageUser = await requireSignedInUser(req, res);
  if (!imageUser) return;
  if (rejectIfLimited(userLimits.agent, imageUser.id, res)) return;
  const { provider: providerId, prompt, aspectRatio = '1:1' } = req.body ?? {};

  const provider = getImageProvider(providerId);
  if (!provider) {
    return res.status(400).json({ error: 'Image provider is not available' });
  }
  if (
    typeof prompt !== 'string' ||
    prompt.trim().length === 0 ||
    prompt.length > IMAGE_PROMPT_MAX_LENGTH
  ) {
    return res.status(400).json({ error: `prompt must be 1 to ${IMAGE_PROMPT_MAX_LENGTH} characters` });
  }
  if (!IMAGE_ASPECT_RATIOS.includes(aspectRatio)) {
    return res.status(400).json({ error: 'aspectRatio is not supported' });
  }
  if (!allowImageRequest(req.ip)) {
    logger.warn(`[${requestId}] image rate limit hit for ${req.ip}`);
    return res.status(429).json({ error: 'Too many image requests. Please wait a minute and try again.' });
  }

  logger.info(`[${requestId}] image request provider=${provider.id} aspectRatio=${aspectRatio}`);
  const controller = new AbortController();
  res.on('close', () => controller.abort());

  try {
    const result = await provider.generate({ prompt, aspectRatio, signal: controller.signal });
    logger.debug(`[${requestId}] image generated provider=${provider.id} model=${result.model} after ${elapsed()}`);
    res.json({
      mimeType: result.mimeType,
      dataBase64: result.dataBase64,
      provider: provider.id,
      model: result.model,
    });
  } catch (err) {
    if (controller.signal.aborted) {
      logger.debug(`[${requestId}] image client disconnected after ${elapsed()}`);
      return;
    }
    logger.warn(`[${requestId}] image failed provider=${provider.id} status=${err.status ?? 'n/a'} after ${elapsed()}: ${err.message}`);
    res.status(502).json({ error: 'Image generation failed. Please try again.' });
  }
});

process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  logger.error('uncaught exception:', err);
});

startAdminWorkers();

app.listen(serverConfig.port, () => {
  logger.info(`Backend running on http://localhost:${serverConfig.port}`);
  startProviderSync();
  startVoiceProbes();
  startLocalHealthSampling();
});
