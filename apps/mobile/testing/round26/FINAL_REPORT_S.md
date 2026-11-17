# Final Report — Beta RC (Rounds 25–26)

Scope: guest voice billing fix, signed-in voice quota, offline UX (web + native), per-IP guest-trial cap, Resend auth-email deliverability, app-links cleanup, deploys, cleanup, PR update.

PR: https://github.com/BrixoByte/askpico/pull/1 — branch `beta-rc1-guest-voice-trial`, head `0997059`.

---

## 1. Status table

| # | Item | Status | Evidence |
|---|------|--------|----------|
| 1 | Guest voice under-billing (first session / dropped heartbeats) | ✅ fixed + live-verified | Migration `0013` + watermark `guest_voice_debit`. Railway logs: `claimed=5 charged=5` then `claimed=15 charged=12` — unbilled elapsed recovered instead of lost |
| 2 | Signed-in voice quota on `/api/agent/chat` | ✅ fixed + live-verified | Shared `voiceTurnGate`. Live test at 1800/1800s → `403 QUOTA_EXHAUSTED`; at 0s → passes gate |
| 3 | Web offline banner | ✅ done + device-verified | `?pico-offline` deep-link shows amber banner on prod; session stays signed-in (screenshot) |
| 4 | Native offline Retry | ✅ done + device-verified | Toast "Still offline. Check your connection.", "RETRYING…" disabled during reload, 3× spam-tap → 1 reload, signed-in session preserved — `testing/round26/*.png` |
| 5 | Per-IP guest-trial cap | ✅ done + live-verified | Migration `0014` + `guest_trial_grants` writing rows; `granted_seconds=120`, `ip_hash` = HMAC only (no raw IPs). Cap: 8 grants/IP/24h → 30s reduced. IPv6→/64 |
| 6 | Auth-email deliverability | ✅ verified via 3rd-party receiver | mail-tester real reset email: **9.1/10**, `spf=pass`, `dkim=pass (d=mail.askpico.app)`; DMARC record live in DNS |
| 7 | App links / assetlinks | ✅ done | `go.` + `auth.` serve `assetlinks.json` (200, `application/json`); apex `askpico.app` removed from manifest (`268259a`) |
| 8 | Web deploy (Pages) | ✅ live | `index-a1776c20.js`, e4adbe44 deployment |
| 9 | API deploy (Railway) | ✅ live | Deployment `16560f5b-a9ac-4d86-8f14-069580d87394` SUCCESS |
| 10 | Phone cleanup | ✅ done | ~40 uiautomator XML dumps + 6 test JSONs deleted; Clock alarms checked by owner — OK |
| 11 | Migrations applied | ✅ done | `0013`, `0014` run manually in Supabase SQL Editor; verified live |

## 2. Tests

- API (clean committed worktree): **292 total, 290 pass, 0 fail, 2 todo**
- Web: 317 tests pass; `tsc` clean
- `gradle assembleDebug`: BUILD SUCCESSFUL; APK installed on device `119652548M014318`
- Note: full working-tree run shows 2 routing failures caused by the *other session's uncommitted* `routing.js`/`orchestrator.js` WIP — committed code is green.

## 3. Deploy incident (resolved)

- `railway up` from repo root failed twice (railpack can't analyze monorepo) → deployed from standalone `services/api` dir.
- First successful build crashed: committed `server.js` had leaked `aiUsage.js` references from the other session's uncommitted files → hotfix `0997059` removed them (their files untouched, still uncommitted). ~4 min of 502s; API restored.
- `logger.info` is muted in production → audit lines switched to `console.log`; `[voice-trial]`/`[voice-turn]` now visible in Railway logs.

## 4. Remaining minor items

| Item | Detail | Owner |
|------|--------|-------|
| PR merge + `beta-rc1` tag | Waiting explicit "yes" | user decision |
| QA/test account deletion | `pico.qa.retry@askpico.test`, `pico.qa.quota@askpico.test`, anon users `d129ec36…`, `8d759d43…`, `8353dd9c…`, `cd7f6b3b…`, `c0d4e7d6…`, `f55b571b…`, mail-tester user `test-picoa0qwqt@srv1.mail-tester.com`. Dry-run done; delete only on confirm | user decision |
| `dmarc=none` in mail-tester | Receiver-side negative DNS cache — record is live (`v=DMARC1; p=none; rua=mailto:postmaster@askpico.app; fo=1`). Re-test in a few hours if wanted | auto-resolves |
| Play App Signing fingerprint | Deferred — only needed for Play Store release; debug fingerprint covers direct beta APK | user (when releasing) |
| Other session's WIP | Uncommitted: `apps/admin*`, `aiUsage.js`, `routing.js`, `orchestrator.js`, `llmClient.js`, `server.js` edits. Not committed/deployed by us | other session |
| Deploy worktree | `F:/Developer/Web Apps/askpico-deploy` still exists — can `git worktree remove` when no longer needed | housekeeping |
| IP-cap 9th-grant live test | Cap logic unit-tested; production shows grants writing. Full 9-guest live exercise not run (would create test pollution) | optional |

## 5. Verified production log lines

```
[voice-trial] voice session start user=32cbf5b2 … remaining=120
[voice-trial] voice heartbeat user=32cbf5b2 claimed=5  charged=5  used=5  remaining=115 reason=beat
[voice-trial] voice heartbeat user=32cbf5b2 claimed=15 charged=12 used=17 remaining=103 reason=beat
[voice-turn] agent user=c7d0d54b… blocked=true reason=quota_exhausted
```

## 6. Key values

- Guest trial: 120s; max 30s/step; IP cap 8/24h → 30s reduced; chat free
- Signed-in daily voice: free 30m / weekly 2h / monthly 2h / ultra unlimited
- Reset flow: email → `auth.askpico.app` → "Set a new password" form (device-verified screenshot)
- Resend: sender `Pico <no-reply@mail.askpico.app>`; `send.mail` CNAME→forge.rmta.net; DKIM `resend._domainkey.mail`; DMARC `p=none` live
