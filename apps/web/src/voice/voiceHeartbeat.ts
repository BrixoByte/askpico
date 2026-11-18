// Matches HEARTBEAT_SECONDS on the server.
export const VOICE_HEARTBEAT_MS = 30_000;
// A hidden tab stops the sender after this long; visible again re-arms it.
export const HIDDEN_STOP_MS = 30_000;

export type BeatReason = 'beat' | 'pause' | 'end';

export interface HeartbeatEnv {
  // Fire-and-forget sender — the server debits a fixed interval per call.
  send: (reason: BeatReason) => unknown;
  // True while the tab is hidden: beats are skipped, not queued.
  isHidden: () => boolean;
  // Checked per beat so the guest path can own the user without double-sending.
  canSend: () => boolean;
  // visibilitychange subscription; returns the unsubscribe.
  listenVisibility: (handler: () => void) => () => void;
}

// Billing heartbeat for signed-in voice sessions. Runs one 30 s interval while
// voice mode is on; every sent beat debits one interval server-side. Hidden tabs
// stop being billed (skipped beats), and after HIDDEN_STOP_MS hidden the timer
// is torn down entirely — it re-arms if the tab comes back while voice is on.
// No 'end' beat is sent: for signed-in users each call bills a full interval,
// so a final flush would charge an extra 30 s the user did not use.
export const createSignedInVoiceHeartbeat = (env: HeartbeatEnv) => {
  let beatTimer: ReturnType<typeof setInterval> | null = null;
  let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
  let unsubscribe: (() => void) | null = null;
  let stopped = true;

  const sendBeat = () => {
    if (stopped || env.isHidden() || !env.canSend()) return;
    void env.send('beat');
  };
  const startBeats = () => {
    if (stopped || beatTimer !== null) return;
    beatTimer = setInterval(sendBeat, VOICE_HEARTBEAT_MS);
  };
  const stopBeats = () => {
    if (beatTimer !== null) {
      clearInterval(beatTimer);
      beatTimer = null;
    }
  };
  const clearHiddenTimer = () => {
    if (hiddenTimer !== null) {
      clearTimeout(hiddenTimer);
      hiddenTimer = null;
    }
  };
  const onVisibility = () => {
    if (stopped) return;
    if (env.isHidden()) {
      hiddenTimer = setTimeout(stopBeats, HIDDEN_STOP_MS);
    } else {
      clearHiddenTimer();
      startBeats();
    }
  };

  return {
    start() {
      if (!stopped) return;
      stopped = false;
      startBeats();
      unsubscribe = env.listenVisibility(onVisibility);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      stopBeats();
      clearHiddenTimer();
      unsubscribe?.();
      unsubscribe = null;
    },
  };
};
