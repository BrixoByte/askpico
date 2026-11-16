export type StartRoute = 'chat' | 'auth' | 'auth-expired';

export interface StartState {
  // Session returned by the client after the stored session was read (and refreshed if needed).
  session: { isAnonymous: boolean } | null;
  // A Supabase session key exists in local storage (signed in before on this device).
  storedSession: boolean;
  online: boolean;
  // The session check failed or timed out (about 3 s splash limit).
  checkFailed: boolean;
}

// Start routing (owner decision, Round 19):
// - any session (signed-in or guest) opens chat, the auth screen never flashes
// - no session and nothing stored -> auth screen
// - stored session that could not be refreshed while online -> auth with "Session expired"
// - stored session but offline or the check failed/timed out -> chat (offline screen handles it)
export const decideStartRoute = (s: StartState): StartRoute => {
  if (s.session) return 'chat';
  if (!s.storedSession) return 'auth';
  if (!s.online || s.checkFailed) return 'chat';
  return 'auth-expired';
};
