# Round 63 INVENTORY — voice-mode removal map

Classes: **REMOVE** (voice-only file/dir), **EDIT** (shared file, strip voice parts), **KEEP** (false positive / unrelated).
Grep scope: apps/web, services/api, apps/mobile, docs, README. Excluded: node_modules, dist, .git, supabase/migrations, docs/plans/modules/voice-mode.md (protected), testing/ (history).

## apps/web — REMOVE (voice-only files/dirs)

| path | class | reason |
|---|---|---|
| `src/voice/` — 20 files: session.ts, stt.ts, tts.ts, sentenceChunker.ts, voiceHeartbeat.ts, guestVoiceGate.ts, guestVoiceTimer.ts, audioLevel.ts, micPermission.ts, callRecorder.ts, devLaptopTts.ts, VoiceDebugLogger.ts, sharedAudio.ts + tests (session.bargein/followup/tapRearm, stt.partialFlush/stt.rearm, voiceHeartbeat, devLaptopTts) | REMOVE | entire voice engine |
| `src/components/Voice/` — VoiceController.tsx, VoiceVisualizer.tsx, VoiceStatus.tsx, VoiceWaveIcon.tsx, MicPermissionModal.tsx, MicOnboardingModal.tsx, useVoiceHeartbeat.ts, useGuestVoiceTrial.ts (+ untracked VoiceVisualizer.toggle.test.tsx — dropped on purpose per owner) | REMOVE | voice UI |
| `src/store/voice-store.ts`, `src/store/guest-voice-store.ts` | REMOVE | voice state |
| `src/hooks/useSpeechRecognition.ts` | REMOVE | mic→text dictation into composer (voice typing) |
| `src/utils/speech.ts` | REMOVE | speechRecognitionSupported() only used by voice |
| `src/utils/guestVoiceTrial.test.ts` | REMOVE | tests guestVoiceTimer |
| `src/components/Menu/GuestVoiceTrialRow.tsx` + `.test.tsx` | REMOVE | guest trial sidebar row |
| `src/components/Permissions/PermissionPrompt.tsx` | REMOVE | mic-only prompt (pico:mic-prompt events) |

## apps/web — EDIT (shared files)

| path | lines | class | what to strip |
|---|---|---|---|
| `src/App.tsx` | 28, 216 + PermissionPrompt mount | EDIT | VoiceController + PermissionPrompt mounts/imports |
| `src/api/api.ts` | 4 (TRIAL_OVER import), 166/209 (requestType params), 335-337 (voice fields), 349-390 (voice fns) | EDIT | notifyVoiceSessionComplete, startGuestVoice, sendGuestVoiceHeartbeat, sendVoiceHeartbeat, fetchGuestVoiceTrial, guestVoiceRequest, GuestVoiceResult, UsageSummary voice fields; keep requestType param → always 'text' |
| `src/hooks/useSubmit.ts` | 25, 185-193, 286, 484 | EDIT | pendingVoiceTurn→'voice' branch, markReplyStreamDone, voice-mode routing skip; requestType becomes constant 'text' |
| `src/components/Chat/ChatContent/ChatContent.tsx` | 9-13, 45-66, 95, 154 | EDIT | voice imports, voiceHome gating block, VoiceVisualizer, VoiceStatus ×3 |
| `src/components/Chat/ChatContent/Message/View/EditView.tsx` | 5,12,15-16,32-34,150-155,186-224,334,361-364 | EDIT | voice typing: mic button (VoiceWaveIcon), useSpeechRecognition, spacebar shortcut, voiceSend flow, exitVoiceHome — keep textarea/send |
| `src/components/Menu/MobileSidebarDrawer.tsx` | 7, 67 | EDIT | GuestVoiceTrialRow import+mount |
| `src/components/SettingsMenu/SettingsMenu.tsx` | 23, 203-204, 273-275, 415-422, 752-769, 777 | EDIT | sttLang selector, voice usage row + progress bar, bonusVoiceSeconds, "uses voice" referral copy |
| `src/components/SettingsMenu/AgentSettings.tsx` | 13 | EDIT | 'microphone' capability row (keep overlay/usage/notifications rows) |
| `src/components/UpgradeModal/UpgradePlanModal.tsx` | 30, 45 | EDIT | '…hours of voice per day' plan bullets |
| `src/components/ReferralHub/ReferralHub.tsx` | 49 | EDIT | "or uses voice" → text-only reward copy |
| `src/components/Auth/AuthGateModal.tsx` | 71 | EDIT | "unlock voice, images…" → drop voice from copy |
| `src/components/Artifact/PreviewFrame.tsx` | 52 | EDIT | comment mentions voice — trivial copy edit |
| `src/components/Chat/LowMemoryBanner.tsx` | 5 | EDIT | comment mentions voice — trivial |
| `src/components/Footer.jsx` | 6 | EDIT | 'Voice Mode' nav item |
| `src/main.css` | 565-575 | EDIT | `@keyframes voiceBar` + `.animate-voice-bar` |
| `src/utils/agentIntents.ts` | 3 | EDIT | comment mentions voice — trivial |

## apps/web — KEEP (false positives)

| path | reason |
|---|---|
| `src/utils/sharedTheme.ts` | persistTheme — no voice |
| `src/constants/agents.ts`, `src/constants/prompt.ts` | persona/prompt text mentioning "speak" |
| `src/utils/agentIntents.test.ts`, `src/utils/toolPhrases.test.ts` | "dynamic"/substring matches |
| `src/components/SettingsMenu/TotalTokenCost.tsx` | token cost only |
| `src/i18n.locales.test.ts` + all `public/locales/**/*.json` | **zero voice keys** — mojibake guard untouched |

## services/api — REMOVE

| path | class | reason |
|---|---|---|
| `src/tts.js` | REMOVE | /api/tts provider chain (edge/laptop) |
| `src/voiceHealth.js` | REMOVE | TTS probes + ledger (needs unapplied 0016) |
| `src/voiceQuota.js`, `src/voiceQuotaPolicy.js` | REMOVE | daily voice quota + limits + guest trial math |
| `src/voiceTurnGate.js` | REMOVE | per-turn voice quota gate |
| `src/guestVoice.js` | REMOVE | guest trial debit + IP grants |
| `src/admin/voiceRoutes.js` | REMOVE | /api/admin/voice/* health endpoints |

## services/api — EDIT

| path | lines | class | what to strip |
|---|---|---|---|
| `src/server.js` | 37-48, 59-60, 74-75, 94, 160, 178, 191, 239, 257-263, 309, 578, 686, 713, 721-855, 878-889, 1039-1041, 1062, 1075, 1216-1268 | EDIT | voice imports, `userLimits.voice`+`tts`, voice routes (`/api/voice/*`, `/api/tts*`), voice branch in /api/chat + /api/agent/chat (requestType gate, voiceRule prompt, feature='voice'), session-complete, trial read, usage voice fields, referral `earnedSeconds`(bonus_voice_seconds), `heartbeatReason`, `handleGuestVoice`, `blockVoiceTurnOverQuota`; `requestType` destructured stays (tolerated, always text) |
| `src/guestTrialIp.js` | 3-… | EDIT | `clientIp`+`hashSignal` are SHARED (signup IP/device fingerprint, server.js:592-598) → keep hash utils, remove GUEST_TRIAL_* constants + hashGuestIp if voice-only |
| `src/routing.js` | 22, 32 | EDIT | `requestType==='voice'→smart` clamp; keep chooseMode signature or drop param |
| `src/routingService.js` | 6, 8 | EDIT | stop threading requestType into chooseMode (or leave param—decide Phase 3) |
| `src/tokenQuotaPolicy.js` | 20-30 | EDIT | `shouldCheckTokenCap` → always true; drop feature==='voice' log branch — **any requestType='voice' now counts as text (cap applies; closes abuse path)** |
| `src/orchestrator.js` | 299, 308-312 | EDIT | voiceRule prompt block + requestType param use |
| `src/flags.js` | 42 | EDIT | EXEMPT regex: remove `/api/tts/heartbeat` alternative |
| `src/admin/routes.js` | 9, 12, 46, 251, 291-292, 309, 330-359, 479-522 | EDIT | voiceRouter mount, dailyVoiceLimitSeconds import, `/stats/voice-usage`, voice fields in user selects/payloads (DB columns stay, unused) |
| `src/admin/aiSpendRoutes.js` | 65-113 | EDIT | voice metric fields (voiceUsd, voiceMinutesToday, costPerVoiceMinute…) |
| `src/admin/flagRoutes.js` | 99 | EDIT | `tts_primary` enum (voice flag) |

## apps/mobile — EDIT

| path | lines | class | what to strip |
|---|---|---|---|
| `MainActivity.kt` | 91-125, 204-207, 401-403 (bridgeScript method list), 428-471, 551-619, 621-709, 576-584 | EDIT | SpeechRecognizer + voiceListener + idle/transient restart logic (**goes away with the voice code — Phase 4.4 needs owner PROCEED first**), TextToSpeech + emitTts, voicePermissionLauncher, startVoiceInput/stopVoiceInput/begin/endVoiceSession, speakNative/stopNativeSpeech, silenceForShield (becomes unneeded — also remove its caller) |
| `PicoBridge.kt` | 60-69, 222-231 | EDIT | speak, stopSpeaking, startVoiceInput, stopVoiceInput @JavascriptInterface methods |
| `agent/Capabilities.kt` | 16 | EDIT | 'microphone'→RECORD_AUDIO mapping (web AgentSettings row removed too) |
| `agent/ShieldService.kt` | call site | EDIT | remove `silenceForShield()` call (method removed) |
| `AndroidManifest.xml` | 12 | EDIT | remove `<uses-permission RECORD_AUDIO>` |
| `res/values/strings.xml`, `themes.xml`, `proguard-rules.pro` | — | KEEP | zero voice refs (verified) |

## KEEP (whole files, verified not voice)

routingRules.js, personas.js, localHealth.js, api-security docs, all locale JSONs, marketing app (out of scope), `tokenQuotaPolicy.js` remainder, `flags.js` remainder.

## Phase 1.3 — files importing a voice module (break-risk)

- **@voice/\*** importers: EditView.tsx (6 imports — biggest risk), VoiceVisualizer, VoiceController, useVoiceHeartbeat, useGuestVoiceTrial, GuestVoiceTrialRow, guestVoiceTrial.test.ts
- **voice-store / guest-voice-store** importers: api.ts, useSubmit.ts, SettingsMenu.tsx, ChatContent.tsx, GuestVoiceTrialRow(+test), EditView.tsx + all voice-dir files
- **VoiceWaveIcon / useSpeechRecognition / speech.ts** importer: EditView.tsx only
- **server-side voice modules**: server.js (9 imports), admin/routes.js (voiceRouter, dailyVoiceLimitSeconds), voiceHealth.js↔tts.js (circular — both deleted), flags.js comment
- **native callers**: PicoBridge→MainActivity; ShieldService→silenceForShield; stt.ts→PicoBridge.startVoiceInput (deleted)

## Phase 1.4 — i18n voice keys per locale

**0 keys in all 21 locale dirs** (en, en-US, en-GB, da, de, es, fr, fr-FR, it, ja, ms, nb, ro, ru, sv, vi-VN, yue, zh, zh-CN, zh-HK, zh-TW). Only `ro/model.json` has substring "mic" inside "mici" — false positive. Nothing to remove; mojibake guard unaffected.

## Docs (detail in Phase 5 DOCS_INVENTORY)

Tracked docs with voice refs (hit counts): README.md(3), docs/README.md(2), ADMIN_PANEL_REPORT.md(13), plans/engineering/android-app.md(20), agent-development.md(2), authentication.md(6), branching-strategy.md(9), database.md(2), telemetry-and-feedback.md(5), modules/agent-persona.md(6), memory-system.md(11), product/beta-launch.md(65), beta-progress.md(17), beta-testing.md(16), feature-catalog.md(27), launch-budget.md(1), play-store-compliance.md(7), roadmap.md(3), security/README.md(2), api-security.md(1), data-protection.md(1), threat-model.md(2).
Untracked: `docs/VOICE_MODE.md` (539 lines, written this session — **owner question: is it a duplicate of the protected `docs/plans/modules/voice-mode.md` (138 lines)?** It is NOT a duplicate — VOICE_MODE.md is a detailed rebuild guide for the live implementation; voice-mode.md is the original design doc. Recommend keeping it untracked as the archive; it is never staged.)

## STOP — waiting for owner "PROCEED"
