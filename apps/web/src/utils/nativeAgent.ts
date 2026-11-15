// Typed wrapper around the Android window.PicoBridge agent methods.
// Every call is guarded: on desktop browsers the bridge is absent and
// the helpers return safe defaults so the web app works unchanged.

export type AgentFeature = 'overlay' | 'usage' | 'phone' | 'microphone' | 'notifications';

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
