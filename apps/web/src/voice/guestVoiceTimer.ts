// Active-voice clock for the guest trial. Pure: the caller passes `now` in milliseconds.
// Only time between start/resume and pause counts, so backgrounding or closing voice stops the clock.
// The server enforces the real limit (guest_voice_debit); this clock drives the live countdown and
// the seconds reported in each heartbeat.

export interface TrialTimer {
  // Whole seconds left, as of the last server sync minus seconds already claimed.
  anchorRemaining: number;
  // Sub-second carry plus completed running time, in milliseconds.
  accumulatedMs: number;
  // Start of the current running stretch, or null while paused.
  runningSince: number | null;
}

export const startTrialTimer = (remainingSeconds: number, now: number): TrialTimer => ({
  anchorRemaining: remainingSeconds,
  accumulatedMs: 0,
  runningSince: now,
});

const totalMs = (timer: TrialTimer, now: number) =>
  timer.accumulatedMs + (timer.runningSince === null ? 0 : now - timer.runningSince);

export const pauseTrialTimer = (timer: TrialTimer, now: number): TrialTimer =>
  timer.runningSince === null ? timer : { ...timer, accumulatedMs: totalMs(timer, now), runningSince: null };

export const resumeTrialTimer = (timer: TrialTimer, now: number): TrialTimer =>
  timer.runningSince === null ? { ...timer, runningSince: now } : timer;

export const remainingSeconds = (timer: TrialTimer, now: number): number =>
  Math.max(0, timer.anchorRemaining - Math.floor(totalMs(timer, now) / 1000));

// Takes the whole seconds of active time not yet reported. The sub-second part carries over,
// so frequent heartbeats never lose time to rounding.
export const claimActiveSeconds = (timer: TrialTimer, now: number): { claim: number; timer: TrialTimer } => {
  const total = totalMs(timer, now);
  const claim = Math.floor(total / 1000);
  return {
    claim,
    timer: {
      anchorRemaining: timer.anchorRemaining - claim,
      accumulatedMs: total - claim * 1000,
      runningSince: timer.runningSince === null ? null : now,
    },
  };
};

// The server's balance is authoritative: adopt it when it is lower than the local countdown.
export const adoptServerRemaining = (timer: TrialTimer, serverRemaining: number): TrialTimer => ({
  ...timer,
  anchorRemaining: Math.min(timer.anchorRemaining, serverRemaining),
});

// m:ss for the sidebar row, for example 2:00, 0:20, 0:05.
export const formatTrialTime = (seconds: number): string => {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
};
