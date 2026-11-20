# Round 63 PROGRESS — remove voice mode (text-only)

All times UTC.

## Phase 0 — Safety snapshot

- git status --short (recorded):
  - ` M apps/mobile/testing/round57/PROGRESS.md` (+14 lines, tracked)
  - ` M apps/web/src/components/Voice/VoiceVisualizer.tsx` (+2/-2 — round-60 stop-toggle)
  - `?? .r45tmp/`, `?? apps/admin/...` (WIP, in protected list)
  - `?? apps/web/navp.mjs` (WIP, protected)
  - `?? apps/web/src/components/Voice/VoiceVisualizer.toggle.test.tsx` (round-60 test)
  - `?? docs/VOICE_MODE.md` (voice rebuild doc written earlier this session)
  - `?? supabase/migrations/0012, 0015, 0016, 0017` (WIP, protected)
  - NOTE: `apps/mobile/testing/` is gitignored → round61/62/63 artifacts are local-only.
- Branch: `develop` @ `9fc8386` (HEAD = origin/develop tip).
- Last 5 commits: 9fc8386, 72a78fc, aa38992, c26eeb3, aec13e5.

## Phase 0 STOP — uncommitted changes outside the WIP list

Per instructions: STOP and report before creating the branch.

| file | state | not in WIP list? | options |
|---|---|---|---|
| `apps/web/.../VoiceVisualizer.tsx` | modified (round-60 toggle, owner-approved, never committed) | YES | carry onto branch (file gets deleted in Phase 2 anyway) or revert |
| `apps/mobile/testing/round57/PROGRESS.md` | modified (+14 log lines) | YES | carry onto branch (selective staging in Phase 7 keeps it out of the commit) or revert |
| `apps/web/.../VoiceVisualizer.toggle.test.tsx` | untracked (round-60 test) | YES | stays untracked; deleted with the voice component in Phase 2 |
| `docs/VOICE_MODE.md` | untracked (rebuild doc) | YES | stays untracked — now doubles as the archived reference; will not be staged (Phase 7 stages only Phase 2-5 changes) |

Assessment: all four are SAFE to carry — the two modified tracked files either get deleted with the feature (VoiceVisualizer) or stay unstaged (round57 log). Nothing here would leak into the commit because Phase 7 staging is selective. Branch + backup branch creation is held for owner confirmation per the stop rule.

- 10:37Z — Owner approved "carry all onto branch" with clarifications: stop-toggle dropped on purpose (recorded); docs/VOICE_MODE.md stays untracked, flagged for owner duplicate-check; round57 PROGRESS.md stays unstaged; do not touch WIP list.
- 10:37Z — `git branch backup/pre-text-only` at 9fc8386a30061b61d7a981a364c2e5807c7f5c37 (local only). `git checkout -b feat/text-only` from same commit. Working tree carried over unchanged; no other unexpected changes appeared.

## Phase 1 — Inventory (read only)

- 10:37–10:55Z — Repo-wide grep for voice/stt/tts/speech/mic/microphone/SpeechRecognizer/speechSynthesis/PicoVoice/heartbeat/voiceQuota/voice_seconds/guestVoice/voiceTurn/requestType/edge/laptop/mood/"Start voice mode"/"Tap to talk"/"Voice stopped"/barge across apps/web, services/api, apps/mobile, docs (excluding node_modules, dist, .git, supabase/migrations, docs/plans/modules/voice-mode.md).
- Findings:
  - REMOVE: src/voice/ (20 files), src/components/Voice/ (9 files + untracked toggle test), 2 voice stores, useSpeechRecognition.ts, utils/speech.ts, guestVoiceTrial.test.ts, GuestVoiceTrialRow(+test), PermissionPrompt.tsx; api: tts.js, voiceHealth.js, voiceQuota.js, voiceQuotaPolicy.js, voiceTurnGate.js, guestVoice.js, admin/voiceRoutes.js.
  - EDIT: 16 web files, 9 api files, 5 mobile files (details in INVENTORY.md).
  - KEEP: locales (0 voice keys in all 21 dirs), sharedTheme/prompt/agents constants, strings.xml/themes.xml/proguard (no voice refs).
  - Shared-dependency notes: guestTrialIp.js's hashSignal/clientIp are used by signup logging (non-voice) → keep those functions; ShieldService.kt calls silenceForShield → call must go with the method; EditView.tsx is the highest-risk shared file (6 voice imports).
- Wrote testing/round63/INVENTORY.md (file/line/class/reason table + importer list + i18n result + docs hit list).
- Owner question flagged in INVENTORY.md: docs/VOICE_MODE.md is NOT a duplicate of protected docs/plans/modules/voice-mode.md — awaiting owner view.

## STOP — Phase 1 complete. Waiting for owner "PROCEED" before any file is deleted or edited.

## Phase 2 — Frontend removal (owner said PROCEED + approved 2–5, Phase 7 NOT approved)

- 15:30Z — Baseline test count from git: 55 tracked voice tests + 4 untracked toggle tests ≈ 419 before.
- 15:31Z — Deleted src/voice/ (20 files), components/Voice/ (9 + untracked toggle test), 2 voice stores, useSpeechRecognition.ts, utils/speech.ts, guestVoiceTrial.test.ts, GuestVoiceTrialRow(+test), PermissionPrompt.tsx.
- 15:33Z — Edited 16 shared files: App, api.ts, useSubmit, ChatContent, EditView (mic button/spacebar/voiceSend), MobileSidebarDrawer, SettingsMenu (sttLang, voice usage, referral copy), AgentSettings (microphone row), UpgradePlanModal, ReferralHub, AuthGateModal, Footer, main.css (voiceBar), nativeAgent (microphone union member + mic-specific alert), agentIntents/PreviewFrame/LowMemoryBanner comments.
- 15:40Z — `npx tsc --noEmit` → exit 0.
- 15:46Z — `npm test` (yarn absent on PATH; same `vitest run` script) → 16 files / 360 tests, 0 fail. Delta = deleted voice tests only.
- 15:47Z — `npm run build` (VITE_AGENT_ACTIONS unset → flag OFF) → exit 0, dist/assets/index-c2d7b9d0.js.
- 15:48Z — dist grep: all 17 voice markers 0 hits; residual "voice" = library internals only (WebRTC voiceCall, CSS voice-*, pdf.js glyphs). src/ grep: 0 voice/speech/tts/microphone matches.
- 15:48Z — Diff stat: 53 files, +50/−4,994. WIP untouched; round57 log modified-unstaged; docs/VOICE_MODE.md untracked.
- 15:49Z — Wrote PHASE2_DIFF.md.

## STOP — Phase 2 gates green. Waiting for owner "CONTINUE" before Phase 3 (services/api).

## Phase 3 — Backend removal (owner said CONTINUE)

- 15:55Z — Deleted tts.js, voiceHealth.js, voiceQuota.js, voiceQuotaPolicy.js, voiceTurnGate.js, guestVoice.js, admin/voiceRoutes.js + 4 voice test files.
- 15:56Z — guestTrialIp.js trimmed to hashSignal only (shared by referral signup fraud logging); its test rewritten to a single hashSignal determinism test.
- 15:58Z — server.js: removed all voice imports/limiters/routes/prompt/branches (12 edit points); requestType no longer read anywhere — stale 'voice' requests now treated as text (token cap applies, abuse path closed).
- 16:00Z — tokenQuotaPolicy (shouldCheckTokenCap + voice zeroing), routing.js (voice clamp + MODE_LEVEL), routingService, orchestrator voiceRule, flags.js EXEMPT tts alternative.
- 16:02Z — admin/routes.js (voiceRouter mount, voice select columns, dead last_reset_timestamp, voiceRequests, /stats/voice-usage), aiSpendRoutes voice metrics, flagRoutes tts_primary enum.
- 16:03Z — `node --check` on all 10 edited files: OK.
- 16:05Z — `npm test`: 218 tests — 215 pass, 1 fail (routing.test.js env-blocked: SUPABASE_URL/KEY unset, pre-existing), 2 todo.
- 16:06Z — src grep: 0 real voice/tts/heartbeat/edge/laptop hits (invoice/ledger/edges false positives only). No EDGE_TTS_*/TTS_* env reads remain.
- 16:06Z — Diff stat: 23 files, +43/−1,775. Noted untracked stray src/config.js.new (untouched, not staged).
- 16:06Z — Wrote PHASE3_DIFF.md.

## STOP — Phase 3 gates green. Waiting for owner "CONTINUE" before Phase 4 (apps/mobile).

## Phase 4 — Android shell removal (owner said CONTINUE)

- 16:12Z — Manifest: RECORD_AUDIO removed. Verified no mic dialog/strings exist in res/ (mic rationale was web-side PermissionPrompt, gone in Phase 2).
- 16:12Z — PicoBridge.kt: removed speak, stopSpeaking, startVoiceInput, stopVoiceInput @JavascriptInterface methods.
- 16:13Z — Capabilities.kt: microphone→RECORD_AUDIO mapping removed (overlay/usage/notifications kept).
- 16:13Z — ShieldService.kt: silenceForShield() call removed; audio-focus/mute guard kept (Focus feature, not voice).
- 16:14Z — MainActivity.kt: all SpeechRecognizer + TextToSpeech code removed incl. idle-restart logic (restartListening, MAX_IDLE_RESTARTS), voice bridge block, voicePermissionLauncher, tts init/cleanup, MainActivity.current, RESOURCE_AUDIO_CAPTURE mapping. Kept: webView, bridge token, file chooser/camera capture, requestAccess, runAgentAction, offline/error/retry, shield sync, agent actions.
- 16:15Z — proguard-rules.pro: no voice-specific keep rules — unchanged.
- 16:16Z — `assembleDebug`: BUILD SUCCESSFUL in 29s (no gradlew script in repo; used downloaded Gradle 8.9 distribution from ~/.gradle/wrapper/dists).
- 16:18Z — `testDebugUnitTest`: BUILD SUCCESSFUL in 4s.
- 16:18Z — Merged debug manifest: RECORD_AUDIO absent (0 hits, merged + packaged). app/src/main grep: 0 voice/speech/tts/mic hits.
- 16:19Z — Wrote PHASE4_DIFF.md. Diff stat: 5 files, +3/−296.

## STOP — Phase 4 gates green. Waiting for owner "CONTINUE" before Phase 5 (docs).

## Phase 5 — Documentation (owner said CONTINUE)

- 16:24Z — Wrote DOCS_INVENTORY.md: 16 EDIT files, KEEP list covers protected archive, untracked VOICE_MODE.md, module design archives, beta-progress snapshot, ADMIN_PANEL_REPORT, dev-session notes, bookmark.md, diagram enum, branch-name examples, "Voice note noise reducer" tool, archive links, marketing (out of scope), round reports.
- 16:26Z — beta-launch.md: top changelog line added ("Round 63: voice mode removed; beta is text-only."), §4.1/§11-voice/§12.2 → one-line removal note, ~30 voice mentions stripped, S4/S5/S9/S10/S11 rows removed, M2/M3/M5 milestones updated.
- 16:28Z — feature-catalog.md (plan limits, Voice Roadmap, referral, estimates, rows 83/84), beta-testing.md (§3/§5 → one line; kept dated [x] tts/status checkmark as history), play-store-compliance.md (mic permission/declaration), launch-budget.md (Edge TTS row).
- 16:30Z — android-app.md (voice bridge rows, RECORD_AUDIO, mic disclosure, A4 milestone), authentication.md (mic mentions, voice balance), telemetry-and-feedback.md (voice events), database.md (voice quota → "columns remain unused"; kept memory_items 'voice' enum — still in DB).
- 16:31Z — security docs (README, data-protection, threat-model, api-security), README.md, docs/README.md.
- 16:32Z — Residual grep: remaining hits are KEEP items only (archive links, module archives, snapshot, notes, enum, "Voice note noise reducer" tool, historical checkmarks). voice-mode.md diff = 0 lines; docs/VOICE_MODE.md still untracked.
- 16:32Z — Wrote PHASE5_DIFF.md. Diff stat: 15 files, +88/−161.

## STOP — Phase 5 complete. Next: Phase 6 verification, then FINAL_REPORT.md.

## Phase 6 — behaviour verification (done)

- Local stack: API :3001 + Vite :5173 (`chat.localhost:5173`), flag OFF.
- Web (desktop Chrome, CDP 9223): 0 voice DOM hits; guest anon session + text chat → streamed reply PASS; Magic menu opens (guest sign-in gate = by design); sign-in screen + guest entry PASS.
- Android (TECNO-CL6, debug APK, adb reverse 5173/3001): app opens, no RECORD_AUDIO in dumpsys, `PicoBridge.speak`/`startVoiceInput` undefined, kept bridge methods intact, text reply PASS, history rename+delete PASS, `PicoDownload` intact.
- Transient upstream "empty answer" twice (retried OK) — unrelated.
- Evidence: VERIFY.md, 4 screenshots, FINAL_REPORT.md written.

## Stop point

- Phase 7 (commit) NOT run — awaiting owner approval of the diff.
- No commit/push/tag/deploy; DB untouched.
