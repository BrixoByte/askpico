# FINAL_REPORT_AC — Round 37 (release wiring, compile-only)

No AAB or APK was built. Verification is compile, manifest-processing, unit
test, and `--dry-run` evidence only. No commit, push, tag, deploy, or cloud
config change. No secrets in any file or log.

## Results

| # | Task | Status | Evidence |
|---|------|--------|----------|
| 1 | Call intent → ACTION_DIAL; confirm dialog kept; CALL_PHONE removed from manifest, runtime path, Capabilities, web feature type, Settings row | DONE | `agent/ActionExecutor.kt`, `AndroidManifest.xml`, `agent/Capabilities.kt`, `nativeAgent.ts`, `AgentSettings.tsx`; merged manifests grep CALL_PHONE → 0 matches both variants |
| 2 | R8 + shrinkResources on release; keep rules for JS bridges + manifest classes | DONE (configured; R8 unverified until a release build runs) | `app/build.gradle.kts` release block; `app/proguard-rules.pro`; `gradle tasks` lists `minifyReleaseWithR8` |
| 3 | versionCode 1, versionName 1.0.0-beta.1, bump comment | DONE | `build.gradle.kts` lines ~14–16 |
| 4 | signingConfigs.release from env/-P vars; fail-clear if missing; no debug fallback | DONE | `build.gradle.kts` lines 24–65; `assembleRelease --dry-run` → GradleException listing all four names |
| 5 | compileDebugKotlin, testDebugUnitTest, processDebug/ReleaseManifest; tsc, vitest, web build | DONE | `BUILD SUCCESSFUL in 19s`; 45/45 native, 370/370 web tests; `built in 17.66s` |
| 6 | Locales missing the native offline keys (read-only list) | DONE | `PROGRESS.md` Task 6 — all 20 non-English locales missing; only `values/` exists |

## Versions

- `versionCode = 1`, `versionName = "1.0.0-beta.1"`.

## Merged manifest

- `CALL_PHONE`: **0 matches** in `merged_manifest/debug` and
  `merged_manifest/release` outputs.
- Release `android:usesCleartextTraffic="false"`;
  `network_security_config.xml` `cleartextTrafficPermitted="false"`.

## R8 status

Configured (`isMinifyEnabled`, `isShrinkResources`, proguard rules covering
PicoBridge, PicoDownloader, all `@JavascriptInterface` members, MainActivity,
ShieldService, `agent.**`) — **not verified by a release build** this round.

## Signing wiring

| Variable | Status |
|----------|--------|
| KEYSTORE_PATH | unset |
| KEYSTORE_ALIAS | unset |
| KEYSTORE_PASSWORD | unset |
| KEY_PASSWORD | unset |

`assembleRelease --dry-run` fails with: "Release signing is not configured.
Missing: KEYSTORE_PATH, KEYSTORE_ALIAS, KEYSTORE_PASSWORD, KEY_PASSWORD."
Debug/staging/compile/manifest tasks unaffected.

## Test counts

- Native (`testDebugUnitTest`): 45 tests, 0 failures.
- Web (`vitest run`): 370 tests, 0 failures (+2 call-intent guard tests).
- `tsc --noEmit`: clean. Web build (flag OFF): ✓.

## Files changed

- `apps/mobile/app/build.gradle.kts` — minify/shrink, signing config, version comment
- `apps/mobile/app/proguard-rules.pro` — bridge/service/agent keep rules
- `apps/mobile/app/src/main/AndroidManifest.xml` — CALL_PHONE removed
- `apps/mobile/app/src/main/java/com/askpico/pico/agent/ActionExecutor.kt` — ACTION_DIAL
- `apps/mobile/app/src/main/java/com/askpico/pico/agent/Capabilities.kt` — phone mapping removed
- `apps/web/src/utils/nativeAgent.ts` — `'phone'` removed from AgentFeature
- `apps/web/src/utils/agentIntents.ts` — dialer result text
- `apps/web/src/components/SettingsMenu/AgentSettings.tsx` — capability row removed
- `apps/web/src/utils/agentIntents.test.ts` — 2 new guard tests
- `apps/mobile/testing/round37/PROGRESS.md`, `FINAL_REPORT_AC.md` — new

## Flags / accounts

- `VITE_AGENT_ACTIONS` was unset for the final build — shipped flag OFF.
- No account touched this round. No device install. WhatsApp not opened.

## Owner must do

- Decide which offline locales to translate (20 non-English locales missing
  native strings — see PROGRESS.md Task 6).
- Create the release keystore and back it up outside the repo.
- Set `KEYSTORE_PATH`, `KEYSTORE_ALIAS`, `KEYSTORE_PASSWORD`, `KEY_PASSWORD`
  in your own shell/environment — never commit them.
- Run one real release build to verify R8 + shrinking, then test the bridges.
- Rotate the test password (it was shared in chat earlier).
- Commit and PR merge; set `VITE_BACKEND_URL`; redeploy.
