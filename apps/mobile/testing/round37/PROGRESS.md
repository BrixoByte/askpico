# Round 37 — Progress log

Scope: call intent → ACTION_DIAL, CALL_PHONE cleanup, R8/shrink config, versioning,
release signing wiring. Compile and manifest checks only — no AAB/APK built.

## Task 1 — Call intent → ACTION_DIAL, CALL_PHONE removal

- `agent/ActionExecutor.kt`: `confirmCall` now builds
  `Intent(Intent.ACTION_DIAL, tel:number)` — dialer opens pre-filled, user presses
  call. The `Manifest.permission.CALL_PHONE` runtime request inside the confirm
  dialog was removed. Masked-number confirm dialog kept
  (`Call ••••••••••••67?`, Call / Cancel).
- `AndroidManifest.xml`: `<uses-permission android.permission.CALL_PHONE>` removed
  (comment explains DIAL needs no permission).
- `agent/Capabilities.kt`: `"phone" -> CALL_PHONE` mapping removed.
- `nativeAgent.ts`: `'phone'` removed from `AgentFeature` union.
- `AgentSettings.tsx`: "Phone calls" capability row removed (was the only
  CALL_PHONE UI). No i18n keys existed for it — labels were inline English.
- `agentIntents.ts`: `done_call` text → 'Opening the dialer…' (ACTION_DIAL does
  not place a call).
- `MainActivity` `requestPermission` helper left intact — still used for
  RECORD_AUDIO runtime requests.
- Merged manifests (`processDebugMainManifest`, `processReleaseManifest`):
  `grep CALL_PHONE` → **0 matches** in both debug and release.

## Task 1 — unit tests (agentIntents.test.ts, 17/17)

- `call and share always confirm first` — confirms route through confirm dialogs.
- NEW `calls use ACTION_DIAL and never request CALL_PHONE` — asserts
  `Intent(Intent.ACTION_DIAL` present, `ACTION_CALL`/`CALL_PHONE` absent.
- NEW `no code path declares or requests CALL_PHONE` — manifest + Capabilities.kt
  contain no CALL_PHONE.

## Task 2 — R8 + resource shrinking (configuration only)

- `build.gradle.kts` release buildType: `isMinifyEnabled = true`,
  `isShrinkResources = true`. Debug build type untouched.
- `proguard-rules.pro` rewritten. Bridge classes found via
  `grep addJavascriptInterface` in `MainActivity.kt`:
  - `com.askpico.pico.PicoBridge` → JS name `PicoBridge`
  - `com.askpico.pico.PicoDownloader` → JS name `PicoDownload`
  - plus generic `-keepclassmembers` for all `@JavascriptInterface` methods.
- Kept explicitly: `MainActivity`, `agent.ShieldService` (manifest-declared),
  and `com.askpico.pico.agent.**` (ActionExecutor, ActionValidation, Capabilities,
  FocusPolicy, FocusStore, ShieldRules, VaultStore — used by ShieldService).
- `gradle tasks --all` lists `minifyReleaseWithR8` etc. — config accepted.
- NOTE: R8 behaviour is UNVERIFIED until a release build is tested.

## Task 3 — Versioning

- `versionCode = 1`, `versionName = "1.0.0-beta.1"` (unchanged) + comment:
  "every upload to Play must increase versionCode".

## Task 4 — Signing wiring (no keystore)

- `signingConfigs.release` reads `KEYSTORE_PATH`, `KEYSTORE_ALIAS`,
  `KEYSTORE_PASSWORD`, `KEY_PASSWORD` from `-P` gradle properties or environment.
- Validation fires only when a task that signs/packages a release is requested
  (assemble/bundle/package/sign/upload/publish + "release" in name).
  `processReleaseManifest`, `compileDebug*`, `tasks`, IDE sync are unaffected.
- Missing values → `GradleException` listing missing names. No debug fallback.
- Verified: `gradle assembleRelease --dry-run` fails with
  "Release signing is not configured. Missing: KEYSTORE_PATH, KEYSTORE_ALIAS,
  KEYSTORE_PASSWORD, KEY_PASSWORD."
- Current shell: KEYSTORE_PATH unset, KEYSTORE_ALIAS unset,
  KEYSTORE_PASSWORD unset, KEY_PASSWORD unset.

## Task 5 — Compile + manifest checks (no APK/AAB)

```
gradle compileDebugKotlin testDebugUnitTest processDebugMainManifest processReleaseManifest
BUILD SUCCESSFUL in 19s   (30 actionable tasks)
```

- Native unit tests: 45 tests, 0 failures
  (LoadErrorClassifierTest 12, RetryGateTest 3, ActionValidationTest 8,
  FocusPolicyTest 20, VaultKeyPatternTest 2).
- `npx tsc --noEmit`: clean.
- `npx vitest run`: 17 files, 370/370 tests pass.
- `npm run build` (VITE_AGENT_ACTIONS unset → flag OFF): ✓ built in 17.66s.
- Merged manifests: CALL_PHONE absent (debug + release); release has
  `android:usesCleartextTraffic="false"` and
  `network_security_config.xml` `cleartextTrafficPermitted="false"`.

## Task 6 — Offline translation (read-only)

- Native offline strings live in `app/src/main/res/values/strings.xml` only —
  there are no `values-<locale>/` dirs. Every supported locale falls back to
  English for: error_offline_title, error_offline_message, error_retry,
  error_retrying, error_open_browser, error_still_offline (and the
  unreachable/server/timeout titles).
- Web app ships 21 locales: da de en en-GB en-US es fr fr-FR it ja ms nb ro ru
  sv vi-VN yue zh zh-CN zh-HK zh-TW — so 20 non-English locales are missing
  native translations. Owner decides which to add.

## Cleanup

- `adb forward --list`, `adb reverse --list`: empty.
- font_scale 1.0, accelerometer_rotation 1 (auto), zen_mode 0 (DND off),
  enabled_accessibility_services `null` (baseline).
- No files created on the device. Nothing installed this round.
