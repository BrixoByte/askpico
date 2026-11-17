// Typed wrapper around the Android window.PicoBridge agent methods.
// Every call is guarded: on desktop browsers the bridge is absent and
// the helpers return safe defaults so the web app works unchanged.

export type AgentFeature = 'overlay' | 'usage' | 'microphone' | 'notifications';

export type AgentActionName =
  | 'open_app'
  | 'open_url'
  | 'set_alarm'
  | 'set_timer'
  | 'share_whatsapp'
  | 'call';

export interface ShieldRulesPayload {
  enabled: boolean;
  packages: string[];
}

interface PicoBridgeAgent {
  hasCapability?: (feature: string) => boolean;
  requestAccess?: (feature: string) => void;
  performAction?: (action: string, argsJson: string) => string;
  vaultSet?: (key: string, value: string) => boolean;
  vaultHas?: (key: string) => boolean;
  setShield?: (rulesJson: string) => boolean;
  openAppSettings?: () => void;
}

interface PicoActionWindow {
  onResult?: (id: string, status: string) => void;
}

const bridge = (): PicoBridgeAgent | undefined =>
  (window as unknown as { PicoBridge?: PicoBridgeAgent }).PicoBridge;

export const isNativeApp = (): boolean => typeof bridge() !== 'undefined';

export const openAppSettings = (): void => {
  const agent = bridge();
  try {
    if (agent?.openAppSettings) {
      agent.openAppSettings();
      return;
    }
  } catch {
    // Fall through to the manual instructions below.
  }
  alert('Open your phone settings > Apps > Pico > Permissions > Microphone to enable access.');
};

export const hasCapability = (feature: AgentFeature): boolean => {
  try {
    return bridge()?.hasCapability?.(feature) ?? false;
  } catch {
    return false;
  }
};

export const requestAccess = (feature: AgentFeature): void => {
  try {
    bridge()?.requestAccess?.(feature);
  } catch {
    // Native side unavailable; nothing to request.
  }
};

export const setShieldRules = (rules: ShieldRulesPayload): boolean => {
  try {
    return bridge()?.setShield?.(JSON.stringify(rules)) ?? false;
  } catch {
    return false;
  }
};

export const vaultSet = (key: string, value: string): boolean => {
  try {
    return bridge()?.vaultSet?.(key, value) ?? false;
  } catch {
    return false;
  }
};

export const vaultHas = (key: string): boolean => {
  try {
    return bridge()?.vaultHas?.(key) ?? false;
  } catch {
    return false;
  }
};

type CapabilityListener = (feature: string, granted: boolean, permanentlyDenied: boolean) => void;
const capabilityListeners = new Set<CapabilityListener>();

// Native runtime-permission results (window.PicoCapability.onResult). Returns an unsubscribe function.
export const onCapabilityResult = (listener: CapabilityListener): (() => void) => {
  capabilityListeners.add(listener);
  return () => {
    capabilityListeners.delete(listener);
  };
};

(window as unknown as { PicoCapability?: { onResult: CapabilityListener } }).PicoCapability = {
  onResult: (feature, granted, permanentlyDenied) =>
    capabilityListeners.forEach((listener) => listener(feature, granted, permanentlyDenied)),
};

const pending = new Map<string, (status: string) => void>();

const pico = window as unknown as { PicoAction?: PicoActionWindow };
pico.PicoAction = {
  onResult: (id, status) => {
    const resolve = pending.get(id);
    if (!resolve) return;
    pending.delete(id);
    resolve(status);
  },
};

// Low-memory signal from the native shell (MainActivity.onTrimMemory posts to
// window.PicoMemory.onLowMemory). Latched for the session — Android has no
// "memory ok again" callback. Heavy surfaces (artifact preview, shield
// overlay) pause while latched; chat and voice keep working.
let lowMemoryLatched = false;
const lowMemoryListeners = new Set<() => void>();

export const isLowMemoryMode = (): boolean => lowMemoryLatched;

export const subscribeLowMemory = (listener: () => void): (() => void) => {
  lowMemoryListeners.add(listener);
  return () => {
    lowMemoryListeners.delete(listener);
  };
};

// ComponentCallbacks2.TRIM_MEMORY_RUNNING_LOW — anything at or above means pressure.
const TRIM_MEMORY_RUNNING_LOW = 10;

(window as unknown as { PicoMemory?: { onLowMemory: (level: number) => void } }).PicoMemory = {
  onLowMemory: (level: number) => {
    if (level < TRIM_MEMORY_RUNNING_LOW || lowMemoryLatched) return;
    lowMemoryLatched = true;
    lowMemoryListeners.forEach((listener) => listener());
  },
};

/**
 * Runs a device action. Resolves with the status only (`done`, `denied`,
 * `unsupported`, `invalid`, `cancelled`). Vault refs are passed as IDs and
 * resolved on-device; this function never receives or returns their values.
 */
export const runAgentAction = (
  action: AgentActionName,
  args: Record<string, string | number>
): Promise<string> => {
  const b = bridge();
  if (!b?.performAction) return Promise.resolve('unsupported');
  try {
    const { id, status } = JSON.parse(b.performAction(action, JSON.stringify(args))) as {
      id: string;
      status: string;
    };
    if (status !== 'queued') return Promise.resolve(status);
    return new Promise((resolve) => {
      pending.set(id, resolve);
    });
  } catch {
    return Promise.resolve('unsupported');
  }
};

// Focus apps. Passcodes go in and are checked natively; they are never returned or stored in the web layer.
export type FocusStrength = 'STRICT' | 'BALANCED' | 'LIGHT';
export type FocusOutcome =
  | 'OK'
  | 'WRONG_PASSCODE'
  | 'LOCKED'
  | 'NO_PASSCODE'
  | 'NO_SESSION'
  | 'NO_UNBLOCKS'
  | 'WAIT_REQUIRED'
  | 'NO_WAIT';

export interface FocusStatus {
  enabled: boolean;
  hasPasscode: boolean;
  lockRemainingMs: number;
  active?: boolean;
  blocking?: boolean;
  endMs?: number;
  strength?: FocusStrength;
  score?: number;
  unblocksUsed?: number;
  unblocksLeft?: number;
  packages?: string[];
}

export interface LaunchableApp {
  package: string;
  label: string;
}

interface PicoBridgeFocus {
  focusStatus?: () => string;
  focusSetEnabled?: (enabled: boolean) => void;
  focusSetupPasscode?: (passcode: string) => string;
  focusStart?: (json: string) => string;
  focusBeginWait?: () => void;
  focusEarlyUnblock?: (passcode: string) => string;
  focusEmergency?: (passcode: string) => string;
  focusRecover?: (code: string, newPasscode: string) => boolean;
  focusRequestAccountReset?: (newPasscode: string) => boolean;
  listLaunchableApps?: () => string;
}

const focusBridge = (): PicoBridgeFocus | undefined =>
  (window as unknown as { PicoBridge?: PicoBridgeFocus }).PicoBridge;

const safeParse = <T>(raw: string | undefined, fallback: T): T => {
  try {
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const focusStatus = (): FocusStatus => {
  try {
    return safeParse<FocusStatus>(focusBridge()?.focusStatus?.(), { enabled: false, hasPasscode: false, lockRemainingMs: 0 });
  } catch {
    return { enabled: false, hasPasscode: false, lockRemainingMs: 0 };
  }
};

export const focusSetEnabled = (enabled: boolean): boolean => {
  try {
    focusBridge()?.focusSetEnabled?.(enabled);
    return true;
  } catch {
    return false;
  }
};

/** Returns the one-time recovery code, or '' when no code was issued. */
export const focusSetupPasscode = (passcode: string): string => {
  try {
    return focusBridge()?.focusSetupPasscode?.(passcode) ?? '';
  } catch {
    return '';
  }
};

export const focusStart = (lengthMs: number, strength: FocusStrength, packages: string[]): boolean => {
  try {
    return focusBridge()?.focusStart?.(JSON.stringify({ lengthMs, strength, packages })) === 'OK';
  } catch {
    return false;
  }
};

export const focusBeginWait = (): void => {
  try {
    focusBridge()?.focusBeginWait?.();
  } catch {
    // The wait simply isn't recorded; the native side will refuse the unblock.
  }
};

export const focusEarlyUnblock = (passcode: string): FocusOutcome => {
  try {
    return (focusBridge()?.focusEarlyUnblock?.(passcode) ?? 'NO_SESSION') as FocusOutcome;
  } catch {
    return 'NO_SESSION';
  }
};

export const focusEmergency = (passcode: string): FocusOutcome => {
  try {
    return (focusBridge()?.focusEmergency?.(passcode) ?? 'NO_SESSION') as FocusOutcome;
  } catch {
    return 'NO_SESSION';
  }
};

export const focusRecover = (code: string, newPasscode: string): boolean => {
  try {
    return focusBridge()?.focusRecover?.(code, newPasscode) ?? false;
  } catch {
    return false;
  }
};

export const listLaunchableApps = (): LaunchableApp[] => {
  try {
    return safeParse<LaunchableApp[]>(focusBridge()?.listLaunchableApps?.(), []);
  } catch {
    return [];
  }
};
