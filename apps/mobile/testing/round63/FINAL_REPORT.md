# Round 63 — Final report: voice mode removed, beta is text-only

## 1. Summary

- **Branch:** `feat/text-only` (created from `develop` @ `9fc8386a30061b61d7a981a364c2e5807c7f5c37`)
- **Backup ref:** `backup/pre-text-only` (local branch at the same base commit; not pushed)
- **Total diff vs base:** 97 files changed, **+198 / −7,226**
- **Deleted:** 47 files (tracked) + 1 untracked voice test (`VoiceVisualizer.toggle.test.tsx`, the round-60 toggle fix — dropped on purpose)
- **Edited:** 50 files (16 web shared, 13 api, 5 android, 15 docs, plus reports)
- **Not committed, not pushed, not merged.** Working tree only.

## 2. Gates per phase

### Phase 2 — frontend (`apps/web`)

| Gate | Result |
|---|---|
| `tsc --noEmit` | **exit 0** |
| `vitest run` (`yarn test` equivalent — npm used, same script) | **360/360 pass, 0 fail**, 16 files. Baseline ≈419; delta = 55 tracked + 4 untracked deleted voice tests |
| `npm run build` (flag OFF) | **exit 0** → `index-c2d7b9d0.js` |
| dist grep (17 voice markers) | **0 hits**; residual "voice" strings are lib internals only (WebRTC `voiceCall`, CSS `voice-*`, pdf.js glyphs) |
| src grep voice/speech/tts/mic | **0 real refs** |
| i18n | 0 voice keys in all 21 locales; mojibake guard green |

### Phase 3 — backend (`services/api`)

| Gate | Result |
|---|---|
| `node --check` on all edited files | **all OK** |
| `npm test` | **218 tests: 215 pass, 1 fail, 2 todo** — the 1 fail is `routing.test.js`, env-blocked at import (`SUPABASE_URL`/`SUPABASE_KEY` unset); pre-existing, unrelated |
| src grep `voice|tts|heartbeat|edge|laptop` | **0 real hits** (only "invoice"/"ledger" word-parts) |

### Phase 4 — Android (`apps/mobile`)

| Gate | Result |
|---|---|
| `assembleDebug` | **BUILD SUCCESSFUL (~29 s)** — Gradle 8.9 invoked directly from `~/.gradle/wrapper/dists` (repo has no committed `gradlew`) |
| `testDebugUnitTest` | **BUILD SUCCESSFUL (~4 s)** |
| merged debug manifest `RECORD_AUDIO` | **absent** (CAMERA + unrelated permissions intact) |
| `app/src/main` grep voice/speech/tts/mic | **0 hits** |
| release build | not run (per plan) |

### Phase 5 — docs

- 15 tracked planning/product/security docs edited; every "voice is current" claim replaced
  or removed; changelog line added at top of `beta-launch.md`.
- `docs/plans/modules/voice-mode.md`: **0 diff lines** (verified).
- Round reports under `testing/` untouched (history).

## 3. Behaviour verification (Phase 6 — local, flag OFF)

See `VERIFY.md`. Web (desktop Chrome/CDP): guest text chat works (anonymous session → streamed reply), no voice UI, tools menu opens (guest correctly sign-in gated), guest entry + sign-in screen load. Android debug APK on TECNO-CL6 via `adb reverse` (local web build): app opens, no mic permission requested, text chat replies, `PicoBridge.speak`/`startVoiceInput` = `undefined` while `share`/`openExternal`/`vault*`/`focus*`/`hasCapability`/`listLaunchableApps`/`PicoDownload` all present; test chat renamed and deleted in history. Screenshots: `verify_web_guest.png`, `verify_web_chat_reply.png`, `verify_android_launch.png`, `verify_android_chat.png`.

Two transient upstream "empty answer" responses observed (both retried OK) — unrelated to voice removal. Guest-without-session → `sign-in session is required` is expected product behaviour.

## 4. Docs changed

README.md, docs/README.md, docs/plans/engineering/{android-app,authentication,database,telemetry-and-feedback}.md, docs/plans/product/{beta-launch,beta-testing,feature-catalog,launch-budget,play-store-compliance}.md, docs/plans/security/{README,api-security,data-protection,threat-model}.md.

**Deliberately untouched:** `docs/plans/modules/voice-mode.md` (protected archive), `docs/VOICE_MODE.md` (untracked rebuild guide — still `??` in status), all `testing/` round reports, `apps/marketing`, `apps/admin*`, `apps/web/navp.mjs`, `.r45tmp`, migrations 0012 & 0015–0017 (untracked), `apps/mobile/testing/round57/PROGRESS.md` (pre-existing local change, unstaged), `services/api/src/config.js.new` (untracked stray).

## 5. Database — no change

No migration run, no SQL, no writes. Now-unused objects that remain in Supabase:

- `profiles` columns: `bonus_voice_seconds`, `voice_seconds_used_today`, `voice_sessions_completed`
- RPC `voice_quota_debit`
- Tables `guest_trial_grants`, `tts_requests`, `tts_health_checks`
- `admin_audit_log` rows with `p_trigger: 'voice_session'` (historical only)

Removal is a separate owner-approved migration (with backup), intentionally out of scope.

## 6. Owner must do

1. Review the diff and approve the Phase 7 commit (`Remove voice mode; beta is text-only` on `feat/text-only`).
2. Decide whether to merge `feat/text-only` into `develop`.
3. Later: delete Railway vars `EDGE_TTS_ENABLED`, `TTS_SERVICE_URL`, `TTS_VOICE`; drop the §5 DB objects via a separate migration with backup.
4. Update marketing site wording.
5. Play Console: remove the `RECORD_AUDIO` declaration if one exists; ship a release build (only debug was built here).
6. Rotate the test password if not yet done.
