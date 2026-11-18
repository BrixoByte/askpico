// Voice-to-voice session controller (Step 6).
//
// Loop: SpeechInput utterance → user message → existing chat submit path →
// streamed assistant text → SentenceChunker → Speaker queue → repeat.
//
// Barge-in: SpeechInput stays live while TTS plays. Any speech onset stops
// audio immediately (<1s); the resulting utterance cancels an in-flight
// generation and is submitted as the next turn. "stop"-class phrases only
// halt playback/generation without becoming a chat message.

import useStore from '@store/store';
import useVoiceStore from '@store/voice-store';
import { selectOrCreateChat } from '@hooks/useAddChat';
import { ChatInterface } from '@type/chat';
import { ANDROID_REARM_CAP_MESSAGE, SpeechInput, sttSupported, SttHandlers } from './stt';
import { Speaker } from './tts';
import { SentenceChunker } from './sentenceChunker';
import { notifyVoiceSessionComplete } from '@api/api';
import { currentLevel, currentMicStream, startMicLevel, stopMicLevel } from './audioLevel';
import { CallRecorder } from './callRecorder';
import { voiceLatency } from './VoiceDebugLogger';
import { PicoLogger } from '@utils/logger';
import { isNativeMobileApp } from '@utils/device';

// Wake-on-voice tuning: mic level (0..1) that counts as speech, sustained for WAKE_SUSTAIN_MS.
const WAKE_LEVEL = 0.01;
const WAKE_SUSTAIN_MS = 300;
const WAKE_TICK_MS = 100;
// Speech onsets this soon after a reply sentence starts are ignored: the recognizer can pick up
// the reply's own audio, which must not cut the reply off. An onset only ARMS a barge-in —
// stopping playback requires >=2 recognized non-echo words, so beeps/transients can't cut in.
const BARGE_IN_GRACE_MS = 400;
// Post-reply listening bound: after the last TTS chunk ends the mic listens for this long.
// Silence past the window ends the session at idle — it replaces the unbounded silent
// re-arming that kept the recognizer (and its start-beep) cycling for minutes.
const FOLLOW_UP_MS = 8000;
const WAKE_LOG_EVERY_TICKS = 20;
const MIC_RETRY_MS = 2000;

const STOP_PHRASES =
  /^(stop|ruk\s*jao|bas\s*(kar\s*)?(do|de)?|shant|enough|silence|chup)[.!?]*$/i;

// Call-control triggers. Only short utterances count, so a sentence that merely
// contains "hold on" is not treated as a command.
const HOLD_PHRASES =
  /\b(hold(\s+(on|karo|kar\s+do))?|stop\s+for\s+a\s+(second|sec|moment)|wait(\s+a\s+(second|sec|moment)|\s+karo|\s+kar\s+do)?|ruko(\s+zara)?)\b/i;
const MUTE_PHRASES =
  /\b(mute(\s+(ho\s+jao|ho\s+jay|karo|kar\s+do))?|temp\s+mute(\s+ho\s+jao|\s+karo)?|chup\s+ho\s+(jao|jay)|awaz\s+band\s+karo)\b/i;
const UNMUTE_PHRASES =
  /\b(unmute(\s+karo)?|bolo|baat\s+karo|awaz\s+(waps|wapas))\b/i;
const RESUME_PHRASES =
  /\b(continue|resume|unmute|go\s+on|carry\s+on|start\s+again|chalo[\s,]+(shoro|shuru)\b[\s\w]*|shoro\s+kr(ta|ata)\s+hain|shuru\s+karo)\b/i;
const MAX_TRIGGER_WORDS = 6;

const SWITCH_TO_CHAT_PHRASES =
  /\b(?:switch|shift|move|change|go)\s*(?:to|kro|karo|kar\s*do|karein)?\s*(?:pico\s+)?(?:chat|text|typing)(?:\s+mode)?\b|\b(?:pico\s+)?(?:chat|text|typing)\s+mode\b|\blet\s+me\s+type\b|\bi\s+want\s+to\s+type\b|\bchat\s+use\s+karni(?:\s+hai)?\b|\btext\s+mein\s+baat(?:\s+karni)?\b/i;

const UTTERANCE_MERGE_MS = 0;
const SILENCE_MS = 1200;

const VOICE_LEASE_KEY = 'pico-voice-lease';
const LEASE_TTL_MS = 5000;
const LEASE_BEAT_MS = 2000;
const TAB_KEY = 'pico-voice-tab';
// Per-tab identity that survives a reload, so a refreshed tab reclaims its own lease.
const TAB_ID = (() => {
  const fresh = () => Math.random().toString(36).slice(2);
  try {
    const existing = sessionStorage.getItem(TAB_KEY);
    if (existing) return existing;
    const id = fresh();
    sessionStorage.setItem(TAB_KEY, id);
    return id;
  } catch {
    return fresh();
  }
})();

const readLease = (): { id: string; ts: number } | null => {
  try {
    return JSON.parse(localStorage.getItem(VOICE_LEASE_KEY) ?? 'null');
  } catch {
    return null;
  }
};

const heldByOtherTab = () => {
  const lease = readLease();
  return !!lease && lease.id !== TAB_ID && Date.now() - lease.ts < LEASE_TTL_MS;
};

const writeLease = () =>
  localStorage.setItem(VOICE_LEASE_KEY, JSON.stringify({ id: TAB_ID, ts: Date.now() }));

const releaseLease = () => {
  if (readLease()?.id === TAB_ID) localStorage.removeItem(VOICE_LEASE_KEY);
};

export interface VoiceSessionDeps {
  // Submits a user message through the normal chat path (useSubmit).
  submit: () => void;
}

export class VoiceSession {
  private stt = new SpeechInput();
  private speaker = new Speaker();
  private chunker = new SentenceChunker();
  private deps: VoiceSessionDeps;
  private active = false;

  private unsubscribe: (() => void) | null = null;
  private leaseTimer: ReturnType<typeof setInterval> | null = null;
  private awaitingReply = false;
  private generationSeen = false;
  private wakeTimer: ReturnType<typeof setInterval> | null = null;
  private voiceMs = 0;
  private wakeTicks = 0;
  private lastMicRetry = 0;
  private listening = false;
  private ttsQueue: Promise<void> = Promise.resolve();
  private pendingSpeech = 0;
  private audioGen = 0;
  private sessionReported = false;
  private sttHandlers: SttHandlers | null = null;
  private sttPaused = false;
  private recorder = new CallRecorder();
  private unsubscribeVoice: (() => void) | null = null;
  private speakingSince = 0;
  // Text of the reply sentence currently playing — used to reject our own
  // TTS audio when the recognizer hears it back during barge-in listening.
  private speakingText = '';
  private lastSpokenText = '';
  // The question that produced the current reply — its audio tail can surface
  // as a late partial right after playback starts and must not barge it in.
  private lastUserText = '';
  // Timestamp of a speech onset seen during playback; set by onSpeechStart and
  // confirmed into a real barge-in only by >=2 non-echo words in a later result.
  private bargeCandidateAt = 0;
  // Bounded post-reply listening: absolute deadline + timer + whether any
  // recognized words arrived in the window (beep-only onsets don't count).
  private followUpEndsAt = 0;
  private followUpTimer: ReturnType<typeof setTimeout> | null = null;
  private heardWords = false;
  private lastWordsAt = 0;

  // Streamed-reply tracking: which assistant message we're reading and how
  // much of it has already been fed to the chunker.
  private replyKey = '';
  private replyOffset = 0;
  private replyFlushed = false;

  // Utterance merge window — consecutive silence-finalized segments are
  // joined so a mid-sentence pause doesn't split one query into two turns.
  private pendingText = '';
  private mergeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(deps: VoiceSessionDeps) {
    this.deps = deps;
  }

  get isActive() {
    return this.active;
  }

  start() {
    if (this.active) {
      // Post-cap (or any non-fatal stop) the session is active but the recognizer is
      // dead. A tap must re-arm it: stt.start() resets the re-arm counter and calls
      // PicoBridge.startVoiceInput. startStt() itself guards a live window.
      if (!this.listening && !this.sttPaused && !this.awaitingReply) this.startStt();
      return;
    }
    const voice = useVoiceStore.getState();
    voice.setSttSupported(sttSupported());
    if (!sttSupported()) {
      voice.setError('Voice input is not supported on this device — typing works fine.');
      voice.setVoiceMode(false);
      return;
    }
    if (heldByOtherTab()) {
      voice.setVoiceMode(false);
      return;
    }

    writeLease();
    this.leaseTimer = setInterval(writeLease, LEASE_BEAT_MS);
    this.active = true;
    // Inside the Android app the native WakeListener owns the mic; a web stream would conflict with it.
    if (!isNativeMobileApp()) void startMicLevel().then(() => this.startRecording());
    voice.setError(null);
    voice.setPhase('listening');
    this.unsubscribe = useStore.subscribe(this.onStoreChange);
    this.unsubscribeVoice = useVoiceStore.subscribe((state, prev) => this.onControlChange(state, prev));

    this.sttHandlers = {
      onPartial: (text) => this.onPartial(text),
      onUtterance: (text) => this.onUtterance(text),
      onSpeechStart: () => this.onSpeechStart(),
      onError: (message, fatal) => this.onSttError(message, fatal),
      onEnd: () => this.onSttEnd(),
    };
    if (isNativeMobileApp()) {
      this.startStt();
      // The initial listen is bounded like a follow-up window: if nothing is said,
      // the session drops to idle instead of silently re-arming forever.
      this.openFollowUpWindow();
    } else this.startWakeWatch();
  }

  stop() {
    if (!this.active && !this.stt) return;
    this.active = false;
    this.stopWakeWatch();
    this.sttPaused = false;
    this.awaitingReply = false;
    this.audioGen += 1;
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeVoice?.();
    this.unsubscribeVoice = null;
    this.stopRecording();
    this.clearLease();
    stopMicLevel();
    this.clearMergeTimer();
    this.closeFollowUpWindow();
    this.bargeCandidateAt = 0;
    this.speakingText = '';
    this.lastSpokenText = '';
    this.lastUserText = '';
    this.pendingText = '';
    this.replyKey = '';
    this.replyOffset = 0;
    this.replyFlushed = false;
    this.chunker.reset();
    this.stt.abort();
    this.speaker.stop();
    this.ttsQueue = Promise.resolve();
    this.pendingSpeech = 0;
    const voice = useVoiceStore.getState();
    voice.setInterim('');
    voice.setPhase('idle');
  }

  dispose() {
    this.stop();
    this.speaker.dispose();
  }

  // ── STT events ──────────────────────────────────────────────────────────

  private onUtterance(text: string) {
    console.log('[VoiceDebug] utterance', { text, active: this.active });
    this.listening = false;
    if (!this.active) return;
    const trimmed = text.trim();
    if (trimmed === '') return;
    this.heardWords = true;
    this.lastWordsAt = Date.now();

    const speaking = this.speaker.isSpeaking || this.pendingSpeech > 0;
    if (speaking && STOP_PHRASES.test(trimmed)) {
      // "stop" during playback keeps working exactly as before.
      this.interruptOutput();
      return;
    }

    // A final can arrive during playback without a prior partial: treat it as
    // a barge-in the same way (>=2 words, not our own reply audio echoed back).
    if (speaking && !this.confirmBargeIn(trimmed)) return;

    if (SWITCH_TO_CHAT_PHRASES.test(trimmed)) {
      this.switchToChat();
      return;
    }

    if (this.handleControlPhrase(trimmed)) return;

    if (STOP_PHRASES.test(trimmed)) {
      // "stop" halts playback/generation but is never sent as a message.
      this.interruptOutput();
      return;
    }

    // Merge consecutive utterances; submit after a short quiet window.
    this.pendingText = this.pendingText
      ? `${this.pendingText} ${trimmed}`
      : trimmed;
    this.clearMergeTimer();
    this.mergeTimer = setTimeout(() => {
      const final = this.pendingText.trim();
      this.pendingText = '';
      if (final !== '' && this.active) this.submitUtterance(final);
    }, UTTERANCE_MERGE_MS);
  }

  private submitUtterance(text: string) {
    // Switch commands are never sent to the backend, even if they reach this path.
    if (SWITCH_TO_CHAT_PHRASES.test(text)) {
      this.switchToChat();
      return;
    }
    // Barge-in: speech while the bot is replying cancels audio AND the
    // in-flight generation, then the utterance becomes the next turn.
    const state = useStore.getState();
    if (state.generating || this.speaker.isSpeaking || this.pendingSpeech > 0) {
      this.interruptOutput();
    }
    this.pushUserMessage(text);
    this.lastUserText = text;
    this.awaitingReply = true;
    this.generationSeen = false;
    // The recognizer pauses while the turn is submitted and the reply generates —
    // a late partial must not double-submit. Playback resumes it in enqueueSpeech
    // so barge-in can fire while Pico is speaking.
    this.closeFollowUpWindow();
    this.pauseStt();
    console.log('[VoiceDebug] submit turn', { textLen: text.length });
    useVoiceStore.getState().setPhase('thinking');
    voiceLatency.markAudioSent();
    this.deps.submit();
  }

  private onPartial(text: string) {
    console.log('[VoiceDebug] partial', { text, switchMatch: SWITCH_TO_CHAT_PHRASES.test(text) });
    if (text.trim() !== '') {
      this.heardWords = true;
      this.lastWordsAt = Date.now();
    }
    // Barge-in confirmation: an onset was armed during playback; >=2 non-echo
    // words in the interim text make it real and cut the reply immediately.
    if (this.bargeCandidateAt > 0 && (this.speaker.isSpeaking || this.pendingSpeech > 0)) {
      this.confirmBargeIn(text.trim());
    }
    useVoiceStore.getState().setInterim(text);
    if (this.active && SWITCH_TO_CHAT_PHRASES.test(text)) this.switchToChat();
    if (this.active && this.isShortTrigger(text) && RESUME_PHRASES.test(text)) {
      useVoiceStore.getState().setHeld(false);
    }
  }

  private isShortTrigger(text: string) {
    return text.trim().split(/\s+/).length <= MAX_TRIGGER_WORDS;
  }

  // Hold / resume / AI-mute triggers. While held, every utterance is ignored
  // except a resume phrase. Returns true when the utterance was consumed as a
  // control. Mute commands map to aiMuted (replies become text-only); the same
  // state the removed Hold/Mute AI buttons used to toggle.
  private handleControlPhrase(text: string): boolean {
    const voice = useVoiceStore.getState();
    const short = this.isShortTrigger(text);
    if (voice.held) {
      if (short && (RESUME_PHRASES.test(text) || UNMUTE_PHRASES.test(text))) voice.setHeld(false);
      return true;
    }
    if (short && HOLD_PHRASES.test(text)) {
      voice.setHeld(true);
      return true;
    }
    if (short && MUTE_PHRASES.test(text)) {
      if (!voice.aiMuted) {
        voice.setAiMuted(true);
        // Mute also silences whatever is already speaking, like the button did.
        if (useStore.getState().generating || this.speaker.isSpeaking || this.pendingSpeech > 0) this.interruptOutput();
      }
      return true;
    }
    if (short && UNMUTE_PHRASES.test(text) && voice.aiMuted) {
      voice.setAiMuted(false);
      return true;
    }
    return false;
  }

  // Manual overlay buttons and voice triggers both land here. Hold/resume
  // restarts recognition so the spoken buffer is cleared; the mic stays open.
  private onControlChange(
    state: ReturnType<typeof useVoiceStore.getState>,
    prev: ReturnType<typeof useVoiceStore.getState>,
  ) {
    if (state.replyStreamDone !== prev.replyStreamDone && this.active) this.flushReply();
    if (!this.active || !state.voiceMode) return;
    if (state.held !== prev.held) {
      this.clearMergeTimer();
      this.pendingText = '';
      this.audioGen += 1;
      this.speaker.stop();
      if (state.held && useStore.getState().generating) useStore.getState().setGenerating(false);
      this.sttPaused = false;
      this.stt.abort();
      this.startStt();
      useVoiceStore.getState().setPhase('listening');
    }
    if (state.aiMuted && !prev.aiMuted) {
      this.audioGen += 1;
      this.speaker.stop();
    }
  }

  // Leaves voice home: the session stops itself and the composer returns.
  private switchToChat() {
    if (useStore.getState().generating) useStore.getState().setGenerating(false);
    this.stop();
    useVoiceStore.getState().exitVoiceHome();
  }

  private onSpeechStart() {
    // Speech onset during playback only ARMS a barge-in candidate. The reply's
    // own audio and recognizer start-beeps also produce onsets, so playback is
    // cut only when a >=2-word non-echo result follows (see confirmBargeIn).
    const speaking = this.speaker.isSpeaking || this.pendingSpeech > 0;
    if (!speaking) return;
    if (Date.now() - this.speakingSince < BARGE_IN_GRACE_MS) {
      PicoLogger.info('BargeIn', 'Ignored speech onset: inside post-TTS-start grace window');
      return;
    }
    this.bargeCandidateAt = Date.now();
    PicoLogger.info('BargeIn', 'Speech onset during playback; waiting for >=2 non-echo words');
  }

  // Returns true when the text confirms a barge-in (TTS cut, turn continues);
  // false when it should be ignored (echo of our own reply, or too few words).
  private confirmBargeIn(text: string): boolean {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length < 2) {
      PicoLogger.info('BargeIn', 'Ignored onset: fewer than 2 recognized words', { text });
      return false;
    }
    if (this.isEchoOfReply(text)) {
      PicoLogger.info('BargeIn', 'Ignored onset: matches Pico reply audio or the just-submitted question', { text });
      return false;
    }
    PicoLogger.info('BargeIn', 'Barge-in confirmed; stopping reply playback', { text });
    this.bargeCandidateAt = 0;
    this.interruptOutput();
    return true;
  }

  // The recognizer hears Pico's own TTS output through the mic while it listens
  // for a barge-in, and a paused-then-resumed recognizer can also flush a late
  // partial made of the just-submitted question's audio tail. A result whose
  // words all come from either source is that audio coming back, not the user.
  private isEchoOfReply(text: string): boolean {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const spoken = ` ${norm(`${this.speakingText} ${this.lastSpokenText} ${this.lastUserText}`)} `;
    if (!spoken.trim()) return false;
    return norm(text).split(' ').every((w) => spoken.includes(` ${w} `));
  }

  private interruptOutput() {
    this.audioGen += 1;
    this.bargeCandidateAt = 0;
    this.speaker.stop();
    if (useStore.getState().generating) {
      useStore.getState().setGenerating(false);
    }
    useVoiceStore.getState().setPhase('listening');
  }

  private onSttError(message: string, fatal: boolean) {
    this.listening = false;
    useVoiceStore.getState().setError(message);
    useVoiceStore.getState().setInterim('');
    if (fatal || message === ANDROID_REARM_CAP_MESSAGE) {
      // Surface the dead session in the UI: turn the toggle off so the user
      // can re-enable voice mode (mic button) instead of staring at an
      // active-looking but dead session. The re-arm cap takes the same path:
      // without it, voiceMode stays true and the next tap is a no-op because
      // session.start() only runs on a voiceMode transition.
      this.active = false;
      this.awaitingReply = false;
      useVoiceStore.getState().setVoiceMode(false);
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.unsubscribeVoice?.();
      this.unsubscribeVoice = null;
      this.stopRecording();
      this.clearLease();
      this.stt.abort();
      this.speaker.stop();
      useVoiceStore.getState().setPhase('idle');
      // setVoiceMode(false) clears the error, so set it again after the teardown.
      useVoiceStore.getState().setError(message);
    }
  }

  private onSttEnd() {
    this.listening = false;
    if (this.active && !this.sttPaused) useVoiceStore.getState().setPhase('listening');
  }

  // Recognition is aborted while the assistant speaks so its own TTS audio
  // cannot be transcribed and fed back as a user turn (self-loop).
  private startStt() {
    if (!this.sttHandlers || this.listening) return;
    this.listening = true;
    const sttLang = useVoiceStore.getState().sttLang;
    this.stt.start(this.sttHandlers, {
      silenceMs: SILENCE_MS,
      ...(sttLang !== 'auto' ? { lang: sttLang } : {}),
    });
  }

  private pauseStt() {
    if (this.sttPaused || !this.active) return;
    this.sttPaused = true;
    this.listening = false;
    this.clearMergeTimer();
    this.closeFollowUpWindow();
    this.pendingText = '';
    this.bargeCandidateAt = 0;
    this.stt.abort();
  }

  private resumeStt() {
    if (!this.sttPaused || !this.active) return;
    this.sttPaused = false;
    if (isNativeMobileApp()) this.startStt();
  }

  // Wake-on-voice: the recognizer starts only when the mic level shows speech, so an idle session
  // never opens the speech engine (no start chime, no restart churn while the user is silent).
  private startWakeWatch() {
    if (this.wakeTimer) return;
    this.wakeTimer = setInterval(() => this.checkWake(), WAKE_TICK_MS);
  }

  private stopWakeWatch() {
    if (this.wakeTimer) clearInterval(this.wakeTimer);
    this.wakeTimer = null;
    this.voiceMs = 0;
  }

  private checkWake() {
    const busy =
      this.listening ||
      this.sttPaused ||
      this.awaitingReply ||
      this.pendingSpeech > 0 ||
      this.speaker.isSpeaking ||
      useStore.getState().generating;
    const level = currentLevel('listening');
    if (!this.active) return;
    if (++this.wakeTicks % WAKE_LOG_EVERY_TICKS === 0) {
      PicoLogger.info('Wake', 'Mic level', { level: Number(level.toFixed(3)), busy, listening: this.listening });
    }
    if (level < 0 && Date.now() - this.lastMicRetry > MIC_RETRY_MS) {
      this.lastMicRetry = Date.now();
      PicoLogger.info('Wake', 'Mic level monitor not running; retrying getUserMedia');
      void startMicLevel();
    }
    if (busy || level < WAKE_LEVEL) {
      this.voiceMs = 0;
      return;
    }
    this.voiceMs += WAKE_TICK_MS;
    if (this.voiceMs < WAKE_SUSTAIN_MS) return;
    this.voiceMs = 0;
    PicoLogger.info('Wake', 'Voice detected, starting speech recognition', { level: Number(level.toFixed(3)) });
    this.startStt();
  }

  // ── Submit ──────────────────────────────────────────────────────────────

  private pushUserMessage(text: string) {
    let state = useStore.getState();
    const chats = state.chats;
    const index = state.currentChatIndex;
    const hasActive =
      !!chats && index >= 0 && index < chats.length;
    if (!hasActive) selectOrCreateChat();

    state = useStore.getState();
    const chatIndex = state.currentChatIndex;
    if (!state.chats || chatIndex < 0 || chatIndex >= state.chats.length) return;

    const updated: ChatInterface[] = JSON.parse(JSON.stringify(state.chats));
    updated[chatIndex].messages.push({ role: 'user', content: text });
    updated[chatIndex].updatedAt = Date.now();
    state.setChats(updated);
    useVoiceStore.getState().setPendingVoiceTurn(true);
  }

  // ── TTS streaming ───────────────────────────────────────────────────────

  private onStoreChange = (state: ReturnType<typeof useStore.getState>) => {
    const dbgChat = state.chats?.[state.currentChatIndex];
    const dbgLast = dbgChat?.messages[dbgChat.messages.length - 1];
    console.log('[VoiceDebug] store', {
      active: this.active,
      awaitingReply: this.awaitingReply,
      voiceMode: useVoiceStore.getState().voiceMode,
      generating: state.generating,
      lastRole: dbgLast?.role,
      lastLen: dbgLast?.content?.length ?? 0,
      replyOffset: this.replyOffset,
      replyFlushed: this.replyFlushed,
      pendingSpeech: this.pendingSpeech,
    });
    if (!this.active || !this.awaitingReply) return;
    const voice = useVoiceStore.getState();
    if (!voice.voiceMode) return;

    const chats = state.chats;
    const chatIndex = state.currentChatIndex;
    if (!chats || chatIndex < 0 || chatIndex >= chats.length) return;

    const messages = chats[chatIndex].messages;
    const last = messages[messages.length - 1];
    if (state.generating) this.generationSeen = true;
    if (!last || last.role !== 'assistant') {
      this.replyKey = '';
      if (!state.generating && this.generationSeen) this.endTurnWithoutReply(state);
      return;
    }

    const key = `${chats[chatIndex].id}:${messages.length - 1}`;
    if (key !== this.replyKey) {
      this.replyKey = key;
      this.replyOffset = 0;
      this.replyFlushed = false;
      this.chunker.reset();
    }

    const content = last.content ?? '';
    if (content.length > this.replyOffset) {
      voiceLatency.markResponseReceived();
      const delta = content.slice(this.replyOffset);
      this.replyOffset = content.length;
      for (const sentence of this.chunker.feed(delta)) {
        this.enqueueSpeech(sentence);
      }
      if (this.pendingSpeech > 0) voice.setPhase('speaking');
    }

    if (!state.generating) this.flushReply();

    this.maybeReturnToListening(state);
  };

  private enqueueSpeech(sentence: string) {
    const gen = this.audioGen;
    console.log('[VoiceDebug] enqueue', { chars: sentence.length, gen, current: this.audioGen, active: this.active });
    PicoLogger.info('Reply', 'Enqueue reply sentence for TTS', { chars: sentence.length, gen, current: this.audioGen, active: this.active });
    // Keep the recognizer live during playback so the user can barge in.
    // Self-trigger is guarded by the grace window + >=2 non-echo words.
    this.resumeStt();
    if (!useVoiceStore.getState().aiMuted) this.speaker.prefetch(sentence);
    this.pendingSpeech += 1;
    this.ttsQueue = this.ttsQueue
      .then(async () => {
        try {
          if (gen === this.audioGen && this.active && !useVoiceStore.getState().aiMuted) {
            this.speakingSince = Date.now();
            this.speakingText = sentence;
            await this.speaker.speak(sentence);
          }
        } finally {
          this.pendingSpeech -= 1;
          this.lastSpokenText = this.speakingText;
          this.speakingText = '';
          this.maybeReturnToListening(useStore.getState());
        }
      })
      .catch((error) => {
        // A failed sentence must not kill the queue — without this every later reply stays silent.
        PicoLogger.error('Reply', 'Reply sentence playback failed', error);
      });
  }

  // Generation ended without an assistant message (error or cancel): close the turn so listening resumes.
  private endTurnWithoutReply(state: ReturnType<typeof useStore.getState>) {
    this.awaitingReply = false;
    this.generationSeen = false;
    this.maybeReturnToListening(state);
  }

  // Speaks whatever is left of the reply. Runs as soon as the stream ends, so the final sentence
  // does not wait for post-reply work.
  private flushReply() {
    if (!this.awaitingReply || this.replyFlushed || this.replyOffset === 0) return;
    this.replyFlushed = true;
    for (const sentence of this.chunker.flush()) {
      this.enqueueSpeech(sentence);
    }
    this.awaitingReply = false;
    if (!this.sessionReported) {
      this.sessionReported = true;
      notifyVoiceSessionComplete().catch(() => undefined);
    }
  }

  private maybeReturnToListening(state: ReturnType<typeof useStore.getState>) {
    if (!this.active) return;
    const voice = useVoiceStore.getState();
    if (!voice.voiceMode) return;
    // A submitted turn stays open until its reply has started and finished. Without this,
    // the store update right after submit (generating still false) resumes the mic mid-turn.
    if (this.awaitingReply && !(this.generationSeen && !state.generating)) return;
    if (this.pendingSpeech === 0 && !state.generating && !this.speaker.isSpeaking) {
      PicoLogger.info('Session', 'Resuming listening (reply finished)', { pendingSpeech: this.pendingSpeech });
      this.resumeStt();
      this.openFollowUpWindow();
      if (voice.phase === 'speaking' || voice.phase === 'thinking') {
        voice.setPhase('listening');
      }
    }
  }

  // ── Bounded follow-up window (B2) ──────────────────────────────────────

  // Opens the absolute 8-second listening window: after TTS drains (and at
  // session start). Inside the window the recognizer re-arms as usual; at
  // expiry the session goes idle instead of silently cycling forever.
  private openFollowUpWindow() {
    if (!this.active) return;
    this.clearFollowUpTimer();
    this.heardWords = false;
    this.followUpEndsAt = Date.now() + FOLLOW_UP_MS;
    this.followUpTimer = setTimeout(() => this.onFollowUpExpired(), FOLLOW_UP_MS);
  }

  private closeFollowUpWindow() {
    this.clearFollowUpTimer();
    this.followUpEndsAt = 0;
    this.heardWords = false;
  }

  private clearFollowUpTimer() {
    if (this.followUpTimer) clearTimeout(this.followUpTimer);
    this.followUpTimer = null;
  }

  private onFollowUpExpired() {
    this.followUpTimer = null;
    if (!this.active) return;
    // A real turn in flight (words heard, generation, or playback) is never cut —
    // the window only closes on genuine silence.
    const busy =
      this.sttPaused ||
      this.awaitingReply ||
      this.pendingSpeech > 0 ||
      this.speaker.isSpeaking ||
      useStore.getState().generating;
    if (busy) {
      PicoLogger.info('Session', 'Follow-up window expired while a turn was in flight; staying active');
      return;
    }
    // Words heard very recently = the user is mid-utterance. Give the forming
    // turn one short grace instead of cutting it; a stale stray word cannot
    // hold the window open forever.
    if (this.heardWords && Date.now() - this.lastWordsAt < 2000) {
      PicoLogger.info('Session', 'Follow-up window expired mid-speech; one grace recheck');
      this.followUpTimer = setTimeout(() => this.onFollowUpExpired(), 2000);
      return;
    }
    PicoLogger.info('Session', 'follow-up window expired');
    // Same teardown as the re-arm cap path minus the error message: the session
    // goes fully idle so the next tap cleanly starts a fresh listening window.
    this.listening = false;
    this.active = false;
    this.awaitingReply = false;
    this.stt.abort();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.unsubscribeVoice?.();
    this.unsubscribeVoice = null;
    this.stopRecording();
    this.clearLease();
    useVoiceStore.getState().setInterim('');
    useVoiceStore.getState().setVoiceMode(false);
  }

  private startRecording() {
    const mic = currentMicStream();
    if (!this.active || !mic) return;
    if (this.recorder.start(mic)) useVoiceStore.getState().setRecording(true);
  }

  private stopRecording() {
    this.recorder.stop();
    useVoiceStore.getState().setRecording(false);
  }

  private clearLease() {
    if (this.leaseTimer) {
      clearInterval(this.leaseTimer);
      this.leaseTimer = null;
    }
    releaseLease();
  }

  private clearMergeTimer() {
    if (this.mergeTimer) {
      clearTimeout(this.mergeTimer);
      this.mergeTimer = null;
    }
  }
}
