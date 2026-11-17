# Round 28 — FINAL REPORT (beta-critical Medium items)

Branch `beta-rc1-guest-voice-trial`, device TECNO CL6 `119652548M014318`. FEATURE FREEZE respected: nothing committed, pushed, merged or deployed. One auth email used (del1 signup confirm). LLM use: 2 short chats (DOCX ask, tiny HTML artifact).

## Per-item status

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Migration 0013 collision | **DONE** | Live read-only check: `guest_voice_usage`/`guest_trial_grants` exist (200), all ai_spend/flags/health tables + 0012 view 404 → `0013_ai_spend.sql` never applied. Renamed to `0017_ai_spend.sql` (repo only). No destructive SQL. |
| 2 | '10 MB se bari hai' → i18n | **DONE** | `EditView.tsx` uses `attachTooLarge/attachNotText/attachReadFail`; all 17 locales updated; `i18n.locales.test.ts` 85/85 pass. |
| 3 | beta-launch.md promised features | **DONE (report)** | Mermaid, coupons, referral ARE promised in the plan; image studio exists in code + plan. History import and undo toast are NOT evidenced in plan/repo — "Coming soon" overlays left as-is (no builds, per instruction). |
| 4 | Account deletion E2E | **DONE** | del1 account: friendly confirm → deleted → auth.users/chats/voice rows gone → re-login `invalid_credentials` → no crash. Caveat below. QA accounts listed, not deleted. |
| 5 | Attachments device verify | **DONE** + 1 prod bug found/fixed | DOCX extract 200 + exact text; DocumentsUI picker real-tap verified; camera-denied `NotAllowedError` verified; ZIP bridge verified (`r28_real_test.zip` in Downloads, byte-identical). |
| 6 | 48dp targets | **DONE (scoped)** | 10 files fixed via `after:` hit expansion, visuals unchanged. Remaining undersized: artifact-panel buttons, agent-tool UIs, SearchModal rows, quota/upgrade secondary actions. |
| 7 | LoadError.kt review | **DONE** | Reviewed + live-verified offline→RETRY→hint→auto-retry→page load. 4 suspicious items listed in PROGRESS.md (debug-hook race, WebView error page leaks into a11y tree, `pageLoadedOnce` never resets, JVM tests unrunnable here). |
| 8 | Gates + COMMIT_NOTES | **DONE** | Counts below. `round20/COMMIT_NOTES.md` updated with all R28 files. |

## Test counts (run this round)

- `npx tsc -b` (web): clean — after adding `skipLibCheck` to `tsconfig.node.json` (env drift: vite 4.5.14 vs @types/node 18.19.70; was NOT caused by R28 edits).
- `npm test` (web): **333/333 pass** (12 files).
- `npm run build` (web): **success, 17.5s** (tsc && vite build).
- `npm test` (api): **276 tests — 273 pass, 1 fail** (`routing.test.js` env-blocked: needs SUPABASE_URL/SERVICE_ROLE_KEY), **2 known todo**. routingCheck warnings unchanged (owner decision pending).
- JVM tests (`LoadErrorClassifierTest.kt`): NOT run — no gradle wrapper/binary on this machine.
- Device verification: PROGRESS.md + `r28_*.xml/png/zip` artifacts in this folder.

## Bugs found & fixed this round

1. **HIGH — Artifact ZIP download silently fails on Android prod.** `saveDesktopAppZip` revoked the blob URL synchronously; native `PicoDownloader` fetches it asynchronously → "Failed to fetch", no file. Fixed in `desktopPackage.ts` (bridge + delayed revoke, mirrors `downloadFile.ts`). Needs web redeploy.
2. **MED — Email-confirm link didn't confirm.** del1 signup link opened, routed to app "Verifying…", but `email_confirmed_at` stayed NULL. `/verify` path likely fails on the device/host combo. Worked around via admin magic link. Owner should re-test the confirmation URL.
3. **MED — ~25 hardcoded Roman-Urdu strings** across `Agent/*.tsx`, `ArtifactPanel.tsx`, `ErrorBoundary.tsx` etc. (camera-denied fixed; rest out of scope — systemic, needs a sweep).
4. **LOW — tsc gate broken by node_modules drift** (fixed via tsconfig.node.json skipLibCheck).

## Owner must do

1. **Commit** R28 + prior uncommitted work — prod `0ee49e13` still contains uncommitted fixes; local branch was 1 behind `origin` (hotfix `0997059`).
2. **Set `VITE_BACKEND_URL=https://api.askpico.app`** on the Cloudflare Pages project — next git build breaks prod (`:3001` fallback).
3. **Redeploy web** for the ZIP-download fix to reach the app.
4. **Re-test email confirmation** end-to-end (bug #2).
5. **Apply pending migrations** (0012, 0015, 0016, 0017) when those features are approved — 0017 is the renumbered AI-spend file.
6. **Decide** the 2 routingCheck test expectations + QA account deletion (list in PROGRESS.md).
7. **Sweep** remaining Roman-Urdu hardcoded strings (bug #3).
