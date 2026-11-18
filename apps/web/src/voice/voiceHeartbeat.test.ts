// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedInVoiceHeartbeat, HIDDEN_STOP_MS, VOICE_HEARTBEAT_MS } from './voiceHeartbeat';

const makeEnv = () => {
  const state = { hidden: false, canSend: true };
  const visibilityHandlers: Array<() => void> = [];
  const send = vi.fn();
  const env = {
    send,
    isHidden: () => state.hidden,
    canSend: () => state.canSend,
    listenVisibility: (handler: () => void) => {
      visibilityHandlers.push(handler);
      return () => visibilityHandlers.splice(visibilityHandlers.indexOf(handler), 1);
    },
  };
  const fireVisibility = () => visibilityHandlers.forEach((h) => h());
  return { env, send, state, fireVisibility };
};

describe('signed-in voice heartbeat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('heartbeat starts when signed-in voice turns on', () => {
    const { env, send } = makeEnv();
    const hb = createSignedInVoiceHeartbeat(env);
    hb.start();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS * 2 + 500);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledWith('beat');
    hb.stop();
  });

  it('stops when voice turns off', () => {
    const { env, send } = makeEnv();
    const hb = createSignedInVoiceHeartbeat(env);
    hb.start();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS);
    expect(send).toHaveBeenCalledTimes(1);
    hb.stop();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS * 3);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('no heartbeat for guests on the signed-in path', () => {
    const { env, send, state } = makeEnv();
    state.canSend = false; // guest path owns this user
    const hb = createSignedInVoiceHeartbeat(env);
    hb.start();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS * 2);
    expect(send).not.toHaveBeenCalled();
    hb.stop();
  });

  it('no double send: one interval, and a mid-session flip to guest stops billing', () => {
    const { env, send, state } = makeEnv();
    const hb = createSignedInVoiceHeartbeat(env);
    hb.start();
    hb.start(); // second start is a no-op, not a second interval
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS);
    expect(send).toHaveBeenCalledTimes(1);
    state.canSend = false;
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS * 2);
    expect(send).toHaveBeenCalledTimes(1);
    hb.stop();
  });

  it('no send while hidden; after 30 s hidden the timer is torn down, visible re-arms', () => {
    const { env, send, state, fireVisibility } = makeEnv();
    const hb = createSignedInVoiceHeartbeat(env);
    hb.start();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS);
    expect(send).toHaveBeenCalledTimes(1);

    state.hidden = true;
    fireVisibility();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS); // hidden beat skipped
    expect(send).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(HIDDEN_STOP_MS + VOICE_HEARTBEAT_MS); // torn down after 30 s
    expect(send).toHaveBeenCalledTimes(1);

    state.hidden = false;
    fireVisibility();
    vi.advanceTimersByTime(VOICE_HEARTBEAT_MS); // re-armed on return
    expect(send).toHaveBeenCalledTimes(2);
    hb.stop();
  });
});
