# Round 29 — Signup confirmation link investigation

Question: in Round 28 the del1 signup "Confirm email" link routed into the app, showed
"Verifying…", but `email_confirmed_at` stayed NULL. Why?

## Code review — what is correct

Files: `apps/web/src/components/Auth/VerifyPage.tsx`, `apps/web/src/utils/verifyLink.ts`,
`apps/mobile/testing/round22/EMAIL_TEMPLATES.md`, `apps/web/src/components/Auth/AuthModal.tsx` (signUp),
`apps/web/src/api/supabase.ts`.

- **type value**: template emits `type=signup`; `readVerifyParams` allowlists `signup` and
  `verifyOtp({ token_hash, type: 'signup' })` is the correct GoTrue call for a `{{ .TokenHash }}`
  signup link. Recovery uses `type=recovery`. Correct.
- **token_hash handling**: taken from `URLSearchParams` (decoded) and passed raw to verifyOtp.
  `{{ .TokenHash }}` (PKCE-safe hash) is the right template variable — NOT `{{ .ConfirmationURL }}`.
  `signUp` has no `emailRedirectTo`, so Site URL `https://go.askpico.app` + template path is used. Correct.
- **Prefetch consumption**: a GET on the link only loads the SPA — the token is consumed ONLY by the
  `verifyOtp` POST. In a browser the page shows a "Verify email" button and does NOT auto-verify,
  so email scanners/AV link-prefetch/Chrome prerender cannot burn the one-time token. Correct by design.
  In the Android app (UA `PicoApp/…`) it auto-verifies — acceptable, the WebView only loads on a real
  open, not on prefetch.
- **Error handling**: auth errors (invalid/expired/used) → friendly error state. But see the bug below.
- **Logging**: none — verify failures log nothing. See "Owner must do".

## Root cause — BUG found and fixed (minimal)

`verify()` awaited `verifyOtp`, `exchangeCodeForSession`, and `signOut` with **no timeout and no
try/catch**. supabase-js auth calls have no fetch timeout, so on a suspended WebView or flaky
mobile network the promise can stay pending forever → the screen sticks on "Verifying…" and the
request may never reach GoTrue → `email_confirmed_at` stays NULL. This matches Round 28 exactly:
stuck "Verifying…", confirmed_at NULL, and the token likely never consumed (an actually-consumed
signup token would have set confirmed_at). Separately, a transient verify failure dead-ended the
user — the error state only offered "Go to sign in", no retry.

**Fix applied** (apps/web only, feature freeze — no commit/deploy):

- `utils/verifyLink.ts`: new `VERIFY_TIMEOUT_MS` (20s) + `withTimeout(promise, ms)` helper.
- `components/Auth/VerifyPage.tsx`: both auth awaits wrapped in `withTimeout`; whole body in
  try/catch → timeout shows "Verification timed out. Check your connection and try again.",
  any other throw shows the expired-link message; post-confirm `signOut` failures are swallowed
  (confirmation already done); error state gains a **"Try again"** button (resets the `started`
  guard so the same link can be retried).
- `utils/verifyLink.test.ts`: +3 tests (resolve, reject, timeout) — 15/15 pass.

**Gates**: `npx tsc -b` clean · `npm test` **336/336** · `npm run build` **success (14.1s)**.

## Remaining ambiguity

Cannot prove which of two sub-failures Round 28 hit: (a) request never reached GoTrue (hang —
most likely given NULL confirmed_at + stuck spinner), or (b) response lost after server-side
confirm (would have set confirmed_at — ruled out by the NULL). No client logging exists to
distinguish further; Supabase auth logs in the dashboard would show whether a `verify` request
ever arrived.

## Env-blocked API test (from Round 28 gates)

`services/api/test/routing.test.js` — it boots the real API and requires `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` (from `services/api/.env`, which is git-ignored). On this machine the
file/shell env lacked them, so the file failed at import/init. The 2 `todo` + routingCheck
warnings are separate, pre-existing, and need an owner decision.

## Owner must do

1. **Redeploy web** so the timeout+retry fix reaches production users (also carries the R28
   artifact-ZIP fix — currently a one-bundle gap).
2. **Check Supabase dashboard → Auth logs** for the del1 signup attempt — confirms whether the
   verify request arrived (would distinguish hang vs. server error).
3. **Re-run the signup-confirm E2E** with a fresh throwaway address after redeploy: confirm email
   → app opens → auto-verify → "Email verified" → sign in. Also re-test with connectivity toggled
   mid-verify to see the new timeout+retry path.
4. **Add verify-failure logging** (e.g. `console.error`/request_logs) — currently zero observability
   into this path.
5. **Confirm the dashboard template is live** — EMAIL_TEMPLATES.md describes intended templates;
   the actual Supabase template was not inspected this round (no dashboard access used).
