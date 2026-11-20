# Round 63 — Phase 2 diff summary (apps/web frontend)

Branch: `feat/text-only` @ `9fc8386`. Uncommitted (Phase 7 not approved).
Stat: **53 files changed, 50 insertions(+), 4,994 deletions(-)** + 1 untracked file deleted on disk (VoiceVisualizer.toggle.test.tsx).

## Deleted (voice-only)

- `src/voice/` — 20 files: session.ts (799), stt.ts (708), tts.ts (447), sentenceChunker.ts, voiceHeartbeat.ts(+test), guestVoiceGate.ts, guestVoiceTimer.ts, audioLevel.ts, micPermission.ts, callRecorder.ts, devLaptopTts.ts(+test), VoiceDebugLogger.ts, sharedAudio.ts, session.bargein/followup/tapRearm tests, stt.partialFlush/stt.rearm tests
- `src/components/Voice/` — VoiceController, VoiceVisualizer (incl. the round-60 stop-toggle fix, dropped on purpose), VoiceStatus, VoiceWaveIcon, MicPermissionModal, MicOnboardingModal, useVoiceHeartbeat, useGuestVoiceTrial + untracked VoiceVisualizer.toggle.test.tsx
- `src/store/voice-store.ts`, `src/store/guest-voice-store.ts`
- `src/hooks/useSpeechRecognition.ts` (mic→text dictation)
- `src/utils/speech.ts`, `src/utils/guestVoiceTrial.test.ts`
- `src/components/Menu/GuestVoiceTrialRow.tsx` (+test)
- `src/components/Permissions/PermissionPrompt.tsx` (mic-only; components/Permissions/ dir now empty)

## Edited (voice parts removed, behaviour kept)

| file | removed |
|---|---|
| `App.tsx` | VoiceController + PermissionPrompt imports/mounts |
| `api/api.ts` | guest-voice-store import; notifyVoiceSessionComplete, GuestVoiceResult, guestVoiceRequest, startGuestVoice, sendGuestVoiceHeartbeat, sendVoiceHeartbeat, fetchGuestVoiceTrial; GUEST_VOICE_LIMIT handling; UsageSummary voice fields; `requestType` now `'text'`-only (still sent to API) |
| `hooks/useSubmit.ts` | voice-store import; pendingVoiceTurn→'voice' branch (requestType constant 'text'); voice routing-skip condition; markReplyStreamDone call; comment updated |
| `ChatContent.tsx` | VoiceStatus/VoiceVisualizer imports+renders, voiceHome/voiceMode/voiceThreadId state, inVoiceHome branch |
| `EditView.tsx` | 6 voice imports; voiceSend flow; spacebar dictation (page-wide + in-textarea); voice-mode button (VoiceWaveIcon + gateVoiceStart + exitVoiceHome); "voice typing not supported" strip. Send button is now unconditional — text composer, send, attachments untouched |
| `MobileSidebarDrawer.tsx` | GuestVoiceTrialRow import+mount |
| `SettingsMenu.tsx` | voice-store import, sttLang/setSttLang, "Voice input language" SelectMenu block, Voice usage row + progress bar + bonus-mins line, "or uses voice" referral copy |
| `AgentSettings.tsx` | 'microphone' capability row (overlay/usage kept) |
| `UpgradePlanModal.tsx` | '2 hours of voice per day', '5 hours of voice per day' bullets |
| `ReferralHub.tsx` | "or uses voice" removed from reward copy |
| `AuthGateModal.tsx` | "unlock voice," removed from sign-in copy |
| `Footer.jsx` | 'Voice Mode' product link |
| `main.css` | @keyframes voiceBar + .animate-voice-bar |
| `nativeAgent.ts` | 'microphone' from AgentFeature union; generic app-settings alert text (was mic-specific); comment |
| `agentIntents.ts`, `PreviewFrame.tsx`, `LowMemoryBanner.tsx` | comment-only voice mentions |

## Kept / verified

- i18n: 0 voice keys in all 21 locales (confirmed — nothing removed; mojibake guard `i18n.locales.test.ts` 85 tests green)
- Text composer/send/attachments, ModeSelector, LockBadge+gating, routing/agents/tools, memory, downloads, text+deep quota, referral mechanics — untouched
- `requestType` still sent as 'text' to /api/chat and /api/agent/chat (backend contract preserved)

## Gates

| gate | result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm test` (vitest) | **16 files / 360 tests, all pass, 0 fail** — before: 26 files / ~419 (55 tracked + 4 untracked voice tests deleted); delta = deleted voice tests only |
| `npm run build` (`VITE_AGENT_ACTIONS` unset → flag OFF) | exit 0, `index-c2d7b9d0.js` |
| dist grep | SpeechRecognition, speechSynthesis, startVoiceInput, voice-store, RECORD_AUDIO, PicoVoice, "Start voice mode", "Tap to talk", "Voice stopped", voiceHeartbeat, api/voice, api/tts, guestVoice, barge, voiceMode, VoiceStatus, VoiceVisualizer — **0 hits**. Residual "voice" strings are library internals only (WebRTC `voiceCall`, CSS `voice-*` properties, pdf.js glyph names) |

## WIP safety

`git status` after Phase 2: untouched — `apps/admin*` untracked WIP, `supabase/migrations/0012,0015-0017`, `navp.mjs`, `.r45tmp`, `docs/VOICE_MODE.md` (untracked, kept), `testing/round57/PROGRESS.md` (modified, unstaged — not staged).

## STOP — waiting for owner "CONTINUE" before Phase 3.
