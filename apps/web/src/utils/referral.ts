export const REFERRAL_KEY = 'pico-ref';

// Capture ?ref=<code> from the URL once on load, keep it for signup,
// and remove the param so it is not stuck in chat links.
export const captureReferralCode = (): void => {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref')?.trim();
    if (!ref) return;
    localStorage.setItem(REFERRAL_KEY, ref);
    params.delete('ref');
    const query = params.toString();
    window.history.replaceState(null, '', `/${query ? `?${query}` : ''}`);
    import('@api/api')
      .then(({ recordReferralClick }) => recordReferralClick(ref))
      .catch(() => {
        /* click tracking is best-effort */
      });
  } catch {
    // localStorage may be unavailable; ignore
  }
};

export const getReferralCode = (): string | null => {
  try {
    return localStorage.getItem(REFERRAL_KEY);
  } catch {
    return null;
  }
};

const DEVICE_ID_KEY = 'pico-device-id';

// Random per-browser ID sent with the claim. The server stores only a keyed hash.
export const getDeviceId = (): string => {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return '';
  }
};

export const clearReferralCode = (): void => {
  try {
    localStorage.removeItem(REFERRAL_KEY);
  } catch {
    /* ignore */
  }
};

// Records the stored referral with the server once a real (non-anonymous)
// session exists. The code stays in localStorage until the server accepts a
// terminal status (claimed / self / repeat / invalid), so nothing is lost if
// the network or the sign-in state is not ready yet.
export const claimStoredReferral = async (): Promise<void> => {
  const code = getReferralCode();
  if (!code) return;

  const { isSignedInSession } = await import('@api/supabase');
  const { claimReferral } = await import('@api/api');

  if (!(await isSignedInSession())) return;
  try {
    const { status } = await claimReferral(code, getDeviceId());
    if (status === 'claimed' || status === 'self' || status === 'repeat' || status === 'invalid') {
      clearReferralCode();
    }
  } catch {
    // Keep the code — the next app load retries.
  }
};
