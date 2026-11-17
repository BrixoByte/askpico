import type { EmailOtpType } from '@supabase/supabase-js';

// Parses https://go.askpico.app/verify?token_hash=...&type=signup|recovery (email links).
const OTP_TYPES: EmailOtpType[] = ['signup', 'recovery', 'email_change', 'invite', 'magiclink', 'email'];

export const readVerifyParams = (search: string): { tokenHash: string | null; type: EmailOtpType | null } => {
  const params = new URLSearchParams(search);
  const type = params.get('type') as EmailOtpType | null;
  return { tokenHash: params.get('token_hash'), type: type && OTP_TYPES.includes(type) ? type : null };
};

// PKCE flow (?code=...) links can also arrive off-route. supabase-js exchanges
// them automatically during init ONLY when the code verifier exists in storage
// (same browser that requested the email). Without it the exchange is guaranteed
// to fail, so those loads are routed to VerifyPage for a clear error instead of
// a silently dead page.
export const readVerifyCode = (search: string): string | null => new URLSearchParams(search).get('code');

const hasPkceVerifier = (): boolean => {
  try {
    if (typeof localStorage === 'undefined') return false;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.endsWith('-code-verifier') && localStorage.getItem(key)) return true;
    }
  } catch {
    // storage unavailable -> treat as no verifier
  }
  return false;
};

// Safety net for email links that land on `/` (or any route) instead of /verify.
//   'verify-params'  ?token_hash=...&type=... -> render VerifyPage (handles OTP + reset form)
//   'pkce-code'      ?code=... with NO verifier in storage -> VerifyPage shows the error
//   'implicit-hash'  #access_token=...&type=recovery -> supabase-js consumes the hash,
//                    fires PASSWORD_RECOVERY, clears the URL; App shows the reset form
//   'none'           normal visit, render as usual
export type EmailLinkKind = 'verify-params' | 'pkce-code' | 'implicit-hash' | 'none';

// supabase-js auth calls have no fetch timeout; on a suspended WebView or flaky
// mobile network they can stay pending forever. Bound them so the verify screen
// falls back to an error + retry instead of an endless spinner.
export const VERIFY_TIMEOUT_MS = 20_000;

export const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);

export const classifyEmailLink = (pathname: string, search: string, hash: string): EmailLinkKind => {
  if (pathname === '/verify') return 'none';
  const { tokenHash, type } = readVerifyParams(search);
  if (tokenHash && type) return 'verify-params';
  if (readVerifyCode(search)) return hasPkceVerifier() ? 'none' : 'pkce-code';
  if (hash) {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    if (params.get('type') === 'recovery' && params.get('access_token')) return 'implicit-hash';
  }
  return 'none';
};
