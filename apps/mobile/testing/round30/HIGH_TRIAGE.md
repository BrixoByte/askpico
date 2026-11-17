# Round 30 — High-item triage (read-only findings + this round's fix)

## H1 — Chat stream hangs leave `generating` forever (FIXED this round)
- **Severity:** High. **File:** `apps/web/src/hooks/useSubmit.ts`
- **Repro:** a stalled network or a response that never yields makes
  `await reader.read()` (and the initial `getChatCompletionStream` fetch)
  pend forever → composer shows "stop generating" permanently, no error,
  no retry. Matches the R28/R29 stuck-generation symptom.
- **Fix applied:** `timed()` helper — `withTimeout(…, 60 s)` with a friendly
  message — wraps both `getChatCompletionStream` call sites and every
  `reader.read()`. Failure → friendly `setError`, `generating` resets, user
  resends. tsc clean, 341/341 tests.
- **Verify:** code + tests; live stall needs a simulated-hang server — noted
  for owner (LoadError offline path is analogous and was verified in R28).

## H2 — Production does not match `main` (process risk, reported)
- **Severity:** High (operational). `origin/main` = `cace2a5` (initial commit
  only). Production Pages deploy `0ee49e13` was built from PR #1 code
  (`268259a`); remote branch tip is now `0997059` (local is 1 behind).
- **Impact:** nobody can tell what production actually runs; hotfixes land on
  unmerged branches. Owner must merge PR #1 and redeploy from a known SHA.

## H3 — `VITE_BACKEND_URL` unconfirmed on Pages (deploy blocker)
- **Severity:** High. `api.ts:10-12` falls back to `https://<host>:3001` —
  silently broken API on the live domain if the env var is missing.
- **Status:** production bundle contains `api.askpico.app` (someone set it for
  that deploy); the env var itself is not readable — owner must confirm.
  Local dist correctly shows the `:3001` fallback. `VITE_AGENT_ACTIONS` is
  baked as `{}.VITE_AGENT_ACTIONS==="true"` → **off** in the bundle.

## H4 — Migration numbering collision (verified safe, no action)
- Live DB (read-only, R28): guest-trial objects exist; ai-spend objects do
  NOT → `0013_ai_spend.sql` had no applied identity → rename to
  `0017_ai_spend.sql` is safe; no environment has both applied.

## H5 — Signup verify hangs (fixed R29, verified)
- `VerifyPage.tsx`: every auth await is `withTimeout`-wrapped (lines 44, 52,
  61, 71), whole body in try/catch, signOut failure swallowed, Try-again
  button. del2 verified end-to-end on production; t1 `email_confirmed_at` set.

## H6 — Beta-plan gaps still open (owner-visible, not fixed in freeze)
- §11 Voice Step 5 unchecked: server-side voice quota enforcement (bonus
  minutes recorded but not enforced).
- §11 API-security unchecked items: verified session on every user-data route,
  account-scoped queries, HttpOnly/Secure/SameSite cookies, server-side
  PDF/DOCX parse, parameterised queries, full log audit, route-level auth
  tests — the plan's own §6.1 calls these "blockers … fix before any polish".
- §11 Android unchecked: chat action triggers, FCM push, onboarding consent,
  native Profile page.
- §11 Mermaid rows are now satisfied by this round's build (checkboxes in the
  doc can be ticked by the owner); §11/§13 response-cache rows still `[ ]`.
- Chibi character `[ ]` — §6.1 item 6 says it "can ship last or be cut".

## H8 — Image Studio shipped though out of beta scope (FIXED)
- §2 scope table does not include it; owner confirmed it should not launch.
- Only UI entry was `ProjectPage` Studio section → removed; feature code kept.
- tsc clean, 341/341 tests, build OK.

## H7 — Delete/clear-memory confirms lacked dialog semantics (FIXED, A11)
- `role=alertdialog` + `aria-modal` + labelledby/describedby added and
  verified in the live AX tree.

## Stop-line honoured
No fix touched auth flows' logic, payments, deletion semantics, or
migrations — the two code fixes (H1, H7) are additive UX-hardening guards.
