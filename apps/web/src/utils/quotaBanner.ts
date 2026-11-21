// Dismiss key shared by the inline quota banner and the submit error handler.
export const QUOTA_DISMISS_KEY = 'pico_quota_modal_dismissed_at';

const DISMISS_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// The server sends explicit codes on 429s: QUOTA_EXHAUSTED on every daily cap
// (token, guest, request) and UPSTREAM_BUSY when all providers fail. The banner
// kind is decided by the code, not by the message text, so a quota 429 shows
// the daily-limit copy. Rate-limit 429s carry no code — the api layer marks
// them 'Rate limited!' and they keep the busy banner.
export const quotaKindForError = (err: string): 'cap' | 'busy' | null => {
  if (err.includes('QUOTA_EXHAUSTED')) return 'cap';
  if (err.includes('Rate limited!')) return 'busy';
  return null;
};

export const quotaDismissedRecently = (now = Date.now()): boolean => {
  try {
    const at = Number(localStorage.getItem(QUOTA_DISMISS_KEY) ?? 0);
    return now - at < DISMISS_WINDOW_MS;
  } catch {
    return false;
  }
};
