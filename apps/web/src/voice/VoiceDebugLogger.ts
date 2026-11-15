// Round-trip timing for one voice turn, printed to the browser console.
//   T1 markAudioSent        — turn submitted to the chat backend
//   T2 markResponseReceived — first reply text arrives in the app
//   T3 markPlaybackStarted  — first reply audio starts playing
// Only the first T2 and T3 of each turn are recorded; a new T1 starts a new turn.

import { logger } from '../utils/logger';

const LATENCY_STYLE =
  'background: #9EFF00; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 4px;';
const SUMMARY_STYLE =
  'background: #0b0f0e; color: #9EFF00; font-weight: bold; padding: 2px 6px; border-radius: 4px;';

export class VoiceLatencyTracker {
  private startTime: number = 0;
  private firstTokenTime: number = 0;
  private playbackTime: number = 0;

  public markAudioSent() {
    this.startTime = performance.now();
    this.firstTokenTime = 0;
    this.playbackTime = 0;
    console.log(`🎤 [Voice Debug] Audio chunk sent at: ${this.startTime.toFixed(2)}ms`);
    logger.info(`[Voice Debug] Audio chunk sent at: ${this.startTime.toFixed(2)}ms`);
  }

  public markResponseReceived() {
    if (!this.startTime || this.firstTokenTime) return;
    this.firstTokenTime = performance.now();
    const latency = this.firstTokenTime - this.startTime;
    console.log(
      `⚡ [Voice Debug] AI Response Latency (Round-Trip): %c${latency.toFixed(2)} ms`,
      LATENCY_STYLE
    );
    logger.info(`AI Response Latency (Round-Trip): ${latency.toFixed(2)} ms`);
  }

  public markPlaybackStarted() {
    if (!this.startTime || this.playbackTime) return;
    this.playbackTime = performance.now();
    const total = this.playbackTime - this.startTime;
    const firstToken = this.firstTokenTime ? this.firstTokenTime - this.startTime : NaN;
    const speechStart = this.firstTokenTime ? this.playbackTime - this.firstTokenTime : NaN;
    console.log(`🔊 [Voice Debug] Playback started at: ${this.playbackTime.toFixed(2)}ms`);
    logger.info(`[Voice Debug] Playback started at: ${this.playbackTime.toFixed(2)}ms`);
    const summary = `[Voice Latency] T1→T2 first token ${firstToken.toFixed(2)} ms | T2→T3 tts ${speechStart.toFixed(2)} ms | T1→T3 total ${total.toFixed(2)} ms`;
    console.log(`%c${summary}`, SUMMARY_STYLE);
    logger.info(summary);
    this.startTime = 0;
  }
}

export const voiceLatency = new VoiceLatencyTracker();
