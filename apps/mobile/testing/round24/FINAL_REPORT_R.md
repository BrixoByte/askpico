# Round 24 - Final report (nothing committed)

Scope: owner-approved exception (Task 1 only) for the guest voice trial, plus Tasks 2-4 and deploy/cleanup. Feature freeze otherwise held. No auth emails sent. No LLM calls (text was typed but not sent; voice ran only for the trial test).

## Per-task status

### Task 1 - Guest voice trial (2 min lifetime) + sidebar row: PARTIAL
DONE and verified on device:
- Fresh guest row "Voice trial: 2:00 left" above Appearance (screenshot t1_01).
- Countdown while voice runs (1:57 -> 1:42 across 20 s).
- Persistence: after HOME + force-stop + relaunch the row reads from the server (1:54).
- Expiry mid-voice: voice stops by itself, message "Your 2-minute voice trial is over. Sign in to keep talking.", no restart loop, chat kept (t1_02).
- Trial-used row: "Voice trial used" + Sign in; Sign in opens /auth with the sign-in form, no bounce (t1_03).
- Text composer accepts input after expiry (typed, not sent).
- Signed-in test account: no row, no limit text.
- Font scale 2.0: row 48 px high, no clipping (t1_04).
- Production API smoke: start free, heartbeat charges wall-clock-capped seconds, over-limit returns GUEST_VOICE_LIMIT on heartbeat, session start and voice chat turn (no LLM call).

Open issues keeping this PARTIAL:
1. Unexplained first-session under-charge: the server recorded 6 s while the device clock had counted about 35 s before I backgrounded the app. A controlled second session charged correctly (30 s per heartbeat, matching the clock). Not root-caused; needs a look before the trial is treated as tight.
2. Rounding residual: up to 1 s of the final voice time is not charged (server 119 s of 120 after expiry; the row showed 0:01 after a reload). Accepted, not fixed.
3. The row fix (refresh on auth change, deployed as c04fc5b6) was verified after a reload only. A no-reload first-run check was not repeated.

### Task 2 - Mic flow loop check: DONE (small fix made)
- Fix: native "Use text instead" was missing from the blocked screen and hidden in the native explanation modal. Both now show it.
- Device: deny once -> explanation again (no blocked screen, no loop); deny again -> blocked screen with Open Settings / Try Again / Use text instead; Use text instead -> composer works.
- Backgrounding during the system dialog: permission stays denied, no re-prompt, voice returns to idle.
- Caveat: a stale "asked" flag from earlier rounds made the first denial count as permanent; cleared with pm clear for the clean run.

### Task 3 - README and docs: DONE
- README: Node prerequisite 22.5 -> 22.9. Reason: the API `start` script uses `--env-file-if-exists`, which Node added in 22.9 (checked in Node's docs). The dependency floor is 22 (`@supabase/supabase-js` engines). node:sqlite is not used anywhere in the API.
- README: storage bullet now Supabase `agent_messages` plus localStorage; architecture box says Supabase; one line on the guest trial added.
- docs/plans/engineering/authentication.md current-state lines fixed; the older SQLite design table and the "single host" note are left as history (flagged). bookmark.md stack line fixed.

### Task 4 - Offline banner: DONE in code, NOT verified on device
- OfflineBanner: "You are offline. Reconnect to keep chatting. Your account stays signed in." Driven by navigator.onLine events. Never signs out. 2 unit tests pass.
- Not verified: could not toggle network on the device with a reliable result. navigator.onLine inside the WebView may stay true if one path drops. The native offline overlay (main-frame load failure) is unchanged.

### Deploy: DONE (API and web)
- Migration 0011 applied by owner; verified live (table 200, RPC executes).
- API (Railway askpico-api): before b24dcc29-6c30-4f5b-a828-9074c9abaace, after d7e6abeb-88e6-430e-a683-ec40aa130671 (`railway up`; Railway shows no git source for this service).
- Web (Cloudflare Pages askpico-app): before ec22517c-cf15-4166-8d68-b4b88add7beb; after 79c1265a-31aa-44ce-9b6a-eecd942cb05e, then fix c04fc5b6-0413-4d21-9105-92b96fda0a61 (live bundle index-ce36a2e4.js).
- Routes / /auth /verify all 200. Guards: api.askpico.app present, no :3001 URL, VITE_AGENT_ACTIONS not baked.
- Rollback targets if needed: web ec22517c; API b24dcc29 (Railway redeploy).

### Cleanup: DONE
- Font 1.0, rotation auto, DND off, app data cleared, RECORD_AUDIO granted (same as Round 23 end), adb forward and reverse lists empty, no local servers, no Chrome tab opened.
- Anonymous test guests left in the DB for retention to purge: f55b571b-9e36-46fb-9d42-91d87885e06b (used 120) and one font-check guest.

## Tests
- services/api `npm test`: 251 run, 249 pass, 0 fail, 2 known todo (routingCheck). New: guestVoice.test.js 7/7.
- apps/web `yarn test`: 315/315 pass in 12 files (was 302; +13: guestVoiceTrial 7, GuestVoiceTrialRow 4, OfflineBanner 2).
- `tsc`: exit 0. `yarn build` with VITE_BACKEND_URL=https://api.askpico.app: exit 0.
- SQL: guest_voice_debit checked in in-memory Postgres (PGlite 0.5.15, outside the repo): caps, wall-clock clamp, exhaustion, read-only check, cascade delete.

## Limits of guest-trial enforcement (honest)
- A determined user can create new anonymous accounts; each one gets 120 s. The per-IP limit (12 session starts per minute) slows bulk creation but does not stop it. Real per-device limits need a different signal (device or Play Integrity), not built here.
- Voice time with no server call at all (local listening) is not metered by the server. The server meters every session start, heartbeat, and voice turn, and each charge is capped by wall-clock time since the last call. A modified client could skip heartbeats for local listening, so the limit is only as strong as the client's honest reporting for that path.
- Signed-in voice turns through /api/agent/chat still have no daily-quota check (pre-existing gap, not changed). Guest voice turns are now checked there.
- Guest data purge (7 days inactive) also removes the usage row, so a guest who stays away for a week gets a fresh 2:00 only if the anonymous account is also removed.

## Assumption about the sidebar row position
- The row sits in the mobile sidebar drawer (MobileSidebarDrawer) directly above the "Appearance" row (MobileThemeToggle). It is one component (components/Menu/GuestVoiceTrialRow.tsx), so it can be moved by changing one line. The desktop SettingsMenu also has an "Appearance" entry, which I did not change.

## Owner must do
1. Git commit and tag `beta-rc1` (nothing committed this round). Review the Round 24 section appended to testing/round20/COMMIT_NOTES.md.
2. Supabase Authentication > Rate Limits: keep low (unchanged this round).
3. Gmail "Show original" SPF/DKIM/DMARC check for the reset email from Round 23 (still pending).
4. Delete fake test users pico.r4.test, pico.r9.test, picomobileqa20261116 if they are not real inboxes.
5. Phone housekeeping: Clock alarm/timer and Downloads test files.
6. Resend free plan: 100 emails/day on launch day.
7. Look at the first-session under-charge (open issue 1 above) with Railway logs before launch.
8. Decide whether to purge the two anonymous test guests in the DB (IDs above).
