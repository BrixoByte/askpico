# Round 26 — finishing round-25 open items (end-to-end)

Date: 2026-11-16. Branch: `beta-rc1-guest-voice-trial` (on top of PR #1).

## Commits pushed

| Commit | Content |
|---|---|
| `8e1b0cd` | Guest voice under-billing fix + shared voice-turn quota gate |
| `4133f32` | `?pico-offline` simulated-offline hook + native retry rewrite |
| `f5d3d58` | `assetlinks.json` (debug fingerprint) |
| `f7e0f93` | Per-IP guest-trial cap: migration 0014 + `guestTrialIp.js` + wiring + tests |

PR #1 description updated with evidence. NOT merged — waiting for explicit go.

## Test results

- API: **290 tests, 288 pass, 0 fail, 2 known todo** (`cd services/api && npm test`)
- Web: **317 pass**; `tsc --noEmit` clean; `npm run build` clean → `index-a1776c20.js`
- Mobile: `./gradlew assembleDebug -PWEB_URL=https://go.askpico.app` → **BUILD SUCCESSFUL**, APK 8.5 MB
- SQL 0013+0014 verified earlier on real Postgres (PGlite): dropped-heartbeat scenario charges 35/35 s; exhaustion stops at cap.

## Native retry — verified on device (adb, serial 119652548M014318)

| Checklist item | Result | Evidence |
|---|---|---|
| Offline → native "No connection" view | PASS | `offline_view.png` |
| Retry while offline → "Still offline. Check your connection." toast, button unchanged | PASS | `retry_offline_toast.png` |
| Network back → 3× spam taps → "RETRYING…" `enabled="false"`, single reload | PASS | uiautomator: `text="RETRYING…" enabled="false"` |
| Success → normal view, **signed-in session preserved** | PASS | `retry_session_preserved.png` (home "Good to see you", not auth page) |
| Offline again during retry | code-covered: `onReceivedError` re-shows view + re-enables button | — |

Session persisted across `svc wifi/data disable` + `force-stop` + relaunch + no-cache reload.
Signed in with throwaway account `pico.qa.retry@askpico.test` (id `4103980c-981c-440d-9142-e983d231c45b`) — add to cleanup list.

## DNS live check (dig @8.8.8.8)

- `send.mail` → CNAME `send.forge.rmta.net`; SPF `v=spf1 ip4:… ~all` OK; MX `10 feedback.forge.rmta.net` OK; DKIM `resend._domainkey.mail` OK.
- **MISSING: `_dmarc` TXT** → Gmail will show dmarc=none. Record documented in `round22/DNS_RECORDS.md` (updated with live values).

## assetlinks.json live check

- `https://go.askpico.app/.well-known/assetlinks.json` → 200 `application/json` ✅
- `https://auth.askpico.app/.well-known/assetlinks.json` → 200 `application/json` ✅ (same Pages project)
- `https://askpico.app/.well-known/assetlinks.json` → **HTML fallback — file not present on apex.** Copied file into `apps/marketing/.well-known/`; apex deployment is a different pipeline — needs manual deploy.
- Contains **debug** SHA-256 only — Play App Signing fingerprint still needed for release verification.

## Fake-user dry run (SELECT only, nothing deleted)

- Named patterns (`pico.r4.test`, `pico.r9.test`, `picomobileqa20261116`): **0 matches** — already gone.
- Anonymous test guests: **2** — `c0d4e7d6-…` and `f55b571b-…` (created 2026-11-16, round-24 device tests).
- New round-26 QA account: `pico.qa.retry@askpico.test` (`4103980c-…`) — keep or delete on confirm.

## Phone cleanup done via adb

- Deleted 40+ `/sdcard/*.xml` uiautomator dumps and 6 `/sdcard/Download/*.json` test exports.
- `/sdcard/Alarms/` is empty. **2 scheduled Clock alarms exist in `com.transsion.deskclock`** — cannot determine if they're test artifacts or real user alarms; NOT touched (needs owner decision).

## BLOCKED — waiting on owner

1. **Migrations 0013 + 0014** must run in Supabase SQL editor before `railway up`. New API code queries `guest_trial_grants` (missing table → guest voice endpoints would 500).
2. **Admin WIP in working tree** (`apps/admin/*`, `admin/routes.js` + zod, `admin-next` deleted, `0012_admin_users_plans.sql`) is uncommitted. `railway up` ships the whole working tree — decide: commit it first, or confirm it's OK to deploy as-is.
3. Deploy order after that: `railway up --detach` → health check → Railway logs for `[voice-trial]`/`[voice-turn]` lines.

## Deploy phase — incident + resolution (2026-11-16 late)

- **Web:** `index-a1776c20.js` live; `?pico-offline` banner verified on-device via deep link (signed-in session intact).
- **DMARC:** verified live — `v=DMARC1; p=none; rua=mailto:postmaster@askpico.app; fo=1`.
- **Migrations 0013/0014: NOT applied** — `guest_trial_grants` → PGRST205. Owner must run both in SQL editor.
- **API deploy attempts:** (1) `railway up` from worktree root → railpack can't detect app at monorepo root → FAILED ×2. (2) Worked around by deploying `services/api` as a standalone dir → build SUCCESS but **production crashed**: committed `server.js` contained the other session's uncommitted `aiUsage.js` instrumentation (import + 3 `logLlmCall` + `startProviderSync`) — ERR_MODULE_NOT_FOUND, API 502 ~4 min.
- **Hotfix:** stripped the aiUsage references from committed server.js (their files stay uncommitted, untouched), moved `[voice-trial]`/`[voice-turn]` audit lines to `console.log` (`logger.info` is muted when NODE_ENV=production — the first deploy would never have shown them). Commit `0997059` pushed to `beta-rc1-guest-voice-trial` (PR #1). Redeployed `16560f5b` — SUCCESS.
- **Live verification on prod:**
  - Signed-in `/api/agent/chat` `requestType:voice` at 1800/1800 → `403 QUOTA_EXHAUSTED`; at 0 → passes gate (400 chatId). ✅
  - Guest session-start → `120/120` (PGRST205 pre-migration fallback live). Heartbeat 8s → used=8, remaining 112. ✅
  - Railway logs: `[voice-trial] voice session start … remaining=120`, `[voice-trial] voice heartbeat … used=8 remaining=112 reason=beat`, `[voice-turn] agent … blocked=true`. ✅ (pre-0013 `charged` reads 0 — old RPC doesn't return that field)
- **New QA test account:** `pico.qa.quota@askpico.test` id `c7d0d54b-17cb-4aa3-9799-131b430f6880` (+ a few anon users from API tests). Owner deleted earlier test users.
- **Still blocked on owner:** run migrations 0013 + 0014 (then IP-cap + watermark catch-up become active; `charged` starts logging real values), merge PR, tag beta-rc1, Gmail show-original.
