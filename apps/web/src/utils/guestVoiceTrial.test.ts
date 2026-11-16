// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  adoptServerRemaining,
  claimActiveSeconds,
  formatTrialTime,
  pauseTrialTimer,
  refundClaim,
  remainingSeconds,
  resumeTrialTimer,
  startTrialTimer,
} from '@voice/guestVoiceTimer';

const S = 1000;

describe('guest voice trial clock', () => {
  it('counts down active time from the remaining balance', () => {
    const t = startTrialTimer(120, 0);
    expect(remainingSeconds(t, 20 * S)).toBe(100);
    expect(formatTrialTime(remainingSeconds(t, 20 * S))).toBe('1:40');
  });

  it('pauses while the app is in the background and resumes without losing time', () => {
    let t = startTrialTimer(120, 0);
    t = pauseTrialTimer(t, 10 * S);
    expect(remainingSeconds(t, 500 * S)).toBe(110);
    t = resumeTrialTimer(t, 500 * S);
    expect(remainingSeconds(t, 505 * S)).toBe(105);
  });

  it('rounds to whole seconds and keeps the sub-second part for the next claim', () => {
    const t = startTrialTimer(120, 0);
    const first = claimActiveSeconds(t, 2_700);
    expect(first.claim).toBe(2);
    const second = claimActiveSeconds(first.timer, 3_000);
    expect(second.claim).toBe(1);
  });

  it('reports claimed seconds only once', () => {
    const first = claimActiveSeconds(startTrialTimer(120, 0), 30 * S);
    expect(first.claim).toBe(30);
    expect(claimActiveSeconds(first.timer, 30 * S).claim).toBe(0);
    expect(remainingSeconds(first.timer, 30 * S)).toBe(90);
  });

  it('reaches expiry at zero and never goes negative', () => {
    const t = startTrialTimer(5, 0);
    expect(remainingSeconds(t, 4 * S)).toBe(1);
    expect(remainingSeconds(t, 5 * S)).toBe(0);
    expect(remainingSeconds(t, 60 * S)).toBe(0);
    expect(formatTrialTime(0)).toBe('0:00');
  });

  it('persists the remaining balance: a new session starts from the server value, not 2:00', () => {
    const afterRestart = startTrialTimer(73, 1_000_000);
    expect(remainingSeconds(afterRestart, 1_000_000)).toBe(73);
    expect(formatTrialTime(73)).toBe('1:13');
  });

  it('adopts a lower server balance (for example used on another device) but never raises the local one', () => {
    const t = startTrialTimer(100, 0);
    expect(remainingSeconds(adoptServerRemaining(t, 60), 0)).toBe(60);
    expect(remainingSeconds(adoptServerRemaining(t, 150), 0)).toBe(100);
  });

  // The Round 25 billing fix: a heartbeat whose request never landed must not lose
  // its seconds. The failed claim is refunded so the next heartbeat reports it again.
  it('refunds a failed claim so the next heartbeat can report it again', () => {
    const t = startTrialTimer(120, 0);
    const { claim, timer: afterClaim } = claimActiveSeconds(t, 30 * S);
    expect(claim).toBe(30);
    const refunded = refundClaim(afterClaim, claim);
    expect(remainingSeconds(refunded, 30 * S)).toBe(90);
    // The next claim covers the whole 60 s stretch, including the refunded part.
    expect(claimActiveSeconds(refunded, 60 * S).claim).toBe(60);
  });
});
