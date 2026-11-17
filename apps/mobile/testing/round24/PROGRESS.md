# Round 24 - progress log (nothing committed)

## Task 1 - Guest voice trial (2 min lifetime) + sidebar row
- Read: voice start = VoiceVisualizer.startVoice / EditView voice toggle -> gateSignedIn (guest blocked). Server: /api/chat rejected anon voice (403); /api/voice/session-start|heartbeat used daily voice_quota_debit with plan 'guest' (120 s/day). Client never called session-start/heartbeat (daily quota was server-only). /api/agent/chat had NO voice check at all (guest bypass path) -> closed.
- Storage decision: no existing column fits. New table guest_voice_usage + SQL fn guest_voice_debit (supabase/migrations/0011_guest_voice_trial.sql). Keyed by anon auth user id. Owner must apply the migration (no DB URL / Supabase CLI / Supabase MCP available to the agent).
- Server (services/api): guest branch in /api/chat voice turns, /api/agent/chat voice turns, /api/voice/session-start (rateLimit 12/min per IP), /api/voice/heartbeat (claimed seconds clamped to 30), GET /api/voice/trial (read-only). Signed-in path unchanged. Error code GUEST_VOICE_LIMIT (403).
- Client: voice/guestVoiceTimer.ts (pure clock), store/guest-voice-store.ts, api/api.ts guest calls + GUEST_VOICE_LIMIT handling on chat/agent 403, voice/guestVoiceGate.ts (gateVoiceStart + refreshGuestTrial), components/Voice/useGuestVoiceTrial.ts (mounted in VoiceController), components/Menu/GuestVoiceTrialRow.tsx (in MobileSidebarDrawer above Appearance).
- Tests so far: services/api test/guestVoice.test.js 7/7 pass. web guestVoiceTrial.test.ts 7/7 + GuestVoiceTrialRow.test.tsx 4/4 pass. tsc clean (no output).

## Task 1 status at this point
- Migration 0011 not visible in production yet (owner asked for the SQL to run by hand). Live check: GET guest_voice_usage -> 404; rpc guest_voice_debit -> 404 PGRST202. Control: rpc voice_quota_debit (0008) -> 200 no_profile, so the service key is on the right project.
- SQL logic verified locally in PGlite 0.5.15 (in-memory Postgres, outside the repo, /tmp/pgcheck): session start 0/120; heartbeat capped by wall clock (20 s elapsed claim 30 -> 20); per-request cap 30; capped by remaining (110 + 30 -> 120); exhausted at 120; read-only check does not charge; cascade delete on auth.users.
- Test results: services/api `npm test` 251 tests, 249 pass, 0 fail, 2 known todo (routingCheck). apps/web `yarn test` 315/315 pass (12 files). tsc exit 0. `yarn build` (VITE_BACKEND_URL=https://api.askpico.app) exit 0.
- Build guards on dist: api.askpico.app present (1 file); :3001 URL count 0; VITE_AGENT_ACTIONS not baked (bundle compiles to {}.VITE_AGENT_ACTIONS==="true" -> false).
- Deploy NOT done yet: API must go out only after migration 0011 is live (otherwise guest voice returns 502). Frontend must follow the API (old API rejects guest voice on /api/chat).
- Rollback ids recorded: web askpico-app production = ec22517c-cf15-4166-8d68-b4b88add7beb (Round 23 deploy, live). API Railway askpico-api = b24dcc29-6c30-4f5b-a828-9074c9abaace.
- Railway deploy metadata: reason "redeploy", no git source fields (fileServiceManifest empty) -> treated as CLI-deployed; `railway up` is the route, not a git push.

## Task 2 (code change made)
- Native "Use text instead" was missing from the blocked screen (MicOnboardingModal) and hidden in the native explanation modal (MicPermissionModal). Both now show it (native-only styling). VoiceVisualizer passes onDismiss -> exitVoiceHome.
- Loop review (code): the explanation modal re-requests only on an explicit Allow tap. The visibilitychange handler and the 700 ms poll navigate only when permission is granted, so backgrounding cannot re-prompt. Device proof pending deploy.

## Task 4 (code change made)
- OfflineBanner: "You are offline. Reconnect to keep chatting. Your account stays signed in." Driven by navigator.onLine online/offline events. Mounted in App. Does not sign out. Tests 2/2.
- Caveat to verify on device: navigator.onLine inside the WebView may stay true when only one network path drops.

## Task 3 (docs done)
- README: Node prerequisite 22.5 -> 22.9 (the start script uses --env-file-if-exists, added in Node 22.9 per Node docs; node:sqlite not needed). Architecture box "Express, SQLite" -> "Express, Supabase". Storage bullet now Supabase agent_messages + localStorage. One line on the guest voice trial added.
- docs/plans/engineering/authentication.md: lines 13 and 29 (current-state claims) fixed. Lines 37 and 200 are an older SQLite design plan and were left as history (reported). bookmark.md stack line fixed. database.md already correct.

## Deploy (after owner applied migration 0011)
- Owner ran migration 0011 in production. Verified: guest_voice_usage GET 200; guest_voice_debit RPC runs (409 FK on unknown user = function executed).
- API: `railway up --detach` -> deployment d7e6abeb-88e6-430e-a683-ec40aa130671 SUCCESS (before b24dcc29-6c30-4f5b-a828-9074c9abaace). Railway metadata showed no git source, so this is a CLI deploy.
- Web: `wrangler pages deploy dist --project-name=askpico-app --branch=develop`. Deployment 79c1265a-31aa-44ce-9b6a-eecd942cb05e (first), then c04fc5b6-0413-4d21-9105-92b96fda0a61 (fix: row refresh on auth change). Before: ec22517c-cf15-4166-8d68-b4b88add7beb. Live bundle index-ce36a2e4.js.
- Routes: / 200, /auth 200, /verify 200.
- Guards: api.askpico.app in dist (1 file), :3001 URLs 0, VITE_AGENT_ACTIONS not baked.

## Production API smoke (throwaway anonymous user, deleted after; no LLM calls)
- GET /api/voice/trial (fresh guest) 200 remaining 120
- POST session-start 200 remaining 120 (no charge)
- POST heartbeat claim 5 after 6 s wall time 200 remaining 115
- POST heartbeat claim 999 right after: 200 remaining 114 (clamped to 1 s wall time)
- test-only DB set used_seconds=120 for that guest (service REST, not an app override)
- heartbeat 403 GUEST_VOICE_LIMIT; session-start 403 GUEST_VOICE_LIMIT; POST /api/chat requestType voice 403 GUEST_VOICE_LIMIT (rejected before any LLM call)
- GET /api/voice/trial after used 200 remaining 0

## Device test (production APK, WEB_URL=https://go.askpico.app, device 119652548M014318; no adb reverse ports used)
- Fresh guest after pm clear: row "Voice trial: 2:00 left" above Appearance. Screenshot round24/t1_01_sidebar_2min.png.
- Voice on: countdown 1:57 / 1:52 / 1:47 / 1:42 at 5 s steps; Listening. (First bundle attempt showed no row because the guest session appears after mount; fixed by refreshing on auth change.)
- Leave voice: HOME (app backgrounded), force-stop, relaunch -> row 1:54 from server, persisted.
- Controlled second session: server charged 30 s per heartbeat (used 6 -> 36 -> 66), matching the device clock.
- Expiry mid-voice (run to zero): voice stopped by itself, message "Your 2-minute voice trial is over. Sign in to keep talking." shown, no restart loop, chat kept.
- Row after expiry: "Voice trial used" + Sign in (round24/t1_02_trial_used_sidebar.png).
- Text chat: after expiry, reloaded in chat mode, composer present and accepts typing (text NOT sent, to avoid an LLM call).
- Sign in button (row) -> /auth, sign-in form visible, no bounce (round24/t1_03_signin_from_trial.png).
- Signed in as test account: no row, no "used" text, normal account shown.
- Font scale 2.0 on a fresh guest: row 2:00 left, height 48 px, scrollWidth == clientWidth (325), no clipping (round24/t1_04_font200_sidebar.png).

## Issues found on device
1. First-bundle row missing for a new guest until reload -> fixed in c04fc5b6 (verified after reload; the fix was re-verified by a fresh guest at font 2.0 showing the row without reload? -> row appeared after the sign-out/continue-as-guest flow with a reload; see note).
2. Rounding residual: the final sub-second of voice is not charged; server ended at 119 s of 120 after expiry (row showed 0:01 after a reload). Up to 1 s per session. Not fixed; reported.
3. Unexplained first-session under-charge: server recorded 6 s while the device clock ran ~35 s before a HOME flush. Not root-caused. Controlled later session charged correctly (30 s per heartbeat). Open item: confirm with logs before treating the trial as tight.

## Task 2 device results
- Fresh state (pm clear, RECORD_AUDIO revoked). Mic tap -> explanation "Microphone access needed" with Allow microphone + Use text instead (round24/t2_01_explanation.png).
- Allow -> system dialog (GrantPermissionsActivity) -> Don't allow (deny once) -> explanation again (no blocked screen, no loop). round24/t2_02_system_dialog.png.
- Allow again -> dialog -> HOME while dialog up -> return: permission still denied, no re-prompt, voice idle "Tap to talk". Logcat shows no repeated dialog. round24/t2_03_after_background.png.
- Mic again -> Allow -> Don't allow (second denial) -> blocked screen: Open Settings / Try Again / Use text instead (round24/t2_04_blocked.png).
- Use text instead -> composer present and accepts typing (round24/t2_05_use_text_instead.png). Not sent.
- Before this, a stale "asked" flag from earlier rounds made the first denial count as permanent; cleared with pm clear for the clean run.

## Cleanup
- Font 1.0, accelerometer_rotation 1, zen_mode 0, app data cleared (guest session removed), RECORD_AUDIO granted (same as end of Round 23), adb forward/reverse lists empty, no local servers running, no Chrome tab opened this round.
- Test accounts: device guest f55b571b-9e36-46fb-9d42-91d87885e06b left in the DB with used_seconds 120 (anonymous, purged by guest retention); one more anonymous guest created for the font check is also left (anonymous). Owner can delete or wait for retention.
