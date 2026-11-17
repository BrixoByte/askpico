# Android App Plan

**Status:** Planning
**Owner:** Pico product team
**Related:** [Beta launch](../product/beta-launch.md) · [Feature catalog](../product/feature-catalog.md) · [Voice mode](../modules/voice-mode.md) · [Authentication](authentication.md) · [API security](../security/api-security.md)

## 1. Purpose

Pico ships on Android as a native Kotlin app that hosts the web build in a WebView and runs a native **agent layer** alongside it. The agent lets Pico perform real device actions on the user's behalf — sending WhatsApp messages, placing calls, and putting a blocking overlay over distracting surfaces like Reels or Shorts — all under explicit user permission granted during onboarding.

Sensitive data never reaches the AI model, logs, or Pico's servers. It flows through the **Pico Vault**: an on-device encrypted store where values are referenced by opaque IDs (like `.env` entries that functions can use but never print) and rendered only inside masked UI components. This document is the build plan for the beta release.

## 2. Scope

| Area | Beta | v1 | v2 | v3+ |
|---|---|---|---|---|
| Kotlin WebView shell loading the web app | Yes | — | — | — |
| Native voice input bridge (Android `SpeechRecognizer`) | Yes | On-device Whisper upgrade | — | — |
| Splash screen, back-button and lifecycle handling | Yes | — | — | — |
| Share and open-in-browser actions | Yes | — | — | — |
| Push notifications | Yes — announcement broadcasts via FCM | — | Rich/actionable | — |
| Intent actions: place call, open app, share-to-WhatsApp (prefilled), alarms/timers, open URLs | Yes | — | — | — |
| Whole-app distraction shield (usage access + overlay, no accessibility) | Yes | Per-app schedules, focus profiles | — | — |
| Pico Vault (on-device secrets, masked refs, blur rendering) | Yes — strictly local | — | — | Opt-in encrypted backup |
| Onboarding permission consent flow | Yes | — | Agentic-mode opt-in activation | — |
| Accessibility service (dormant agent module, opt-in activation) | No | No — kept out for fast approval | Yes | — |
| Surface shield (block Reels/Shorts inside allowed apps) | — | — | Yes | — |
| Notification reading | — | — | Yes | — |
| Auto-approve rules for repeat actions | — | — | Yes | — |
| WhatsApp full automation and third-party app flows | — | — | — | Yes |
| Camera and file attachments through native pickers | No (web picker) | — | Yes | — |
| Offline tools | No | — | — | Yes |
| iOS | No | — | — | Limited companion only — agent features are Android-only by design |

**Phasing rationale**

- **Beta ships the full non-accessibility feature set** — WebView, voice, auth, chat, splash/back/share, push, intent actions (voice command → call placed, app opened, WhatsApp composer filled, alarms/timers, URLs), the whole-app shield (usage access + overlay), Pico Vault, and the onboarding consent flow. It proves mobile control is real while containing no `AccessibilityService` — no declaration, near-zero review risk.
- **v1 is the production release of the beta feature set** — same features, hardened for the store listing; no new capability, just stability and polish.
- **v2 adds the accessibility layer** with the declaration and demo video once v1 is live and the user base exists; agentic mode activates through the in-app opt-in (separate ToS), dormant by default.
- **v3 ships full automation** — selector recipes, remote-config updates, and telemetry-driven maintenance — because it is the most fragile surface and deserves a dedicated release.

## 3. Architecture

```
Kotlin shell
 ├── WebView (loads go.askpico.app over HTTPS)
 │    └── Pico web build (React + Vite)
 ├── Native layer
 │    ├── SpeechRecognizer bridge (voice input)
 │    ├── Share sheet
 │    ├── Back button / lifecycle
 │    └── Session storage (cookies shared with WebView)
 ├── Agent layer
 │    ├── AccessibilityService (UI automation, surface detection)
 │    ├── Distraction shield (TYPE_ACCESSIBILITY_OVERLAY)
 │    ├── Telecom intents (calls) and app intents
 │    └── Action executor (runs actions locally, reports status only)
 └── Pico Vault
      ├── Keystore-backed encrypted store
      ├── Reference resolver (opaque IDs → real values, on-device)
      └── Masked rendering (blur components, FLAG_SECURE)
```

**Rules**

- The app loads `https://go.askpico.app` over HTTPS. It does not bundle the web build, so web fixes ship without an app update.
- The WebView is locked to `*.askpico.app`. External links open in the device browser.
- All LLM and data calls go to `api.askpico.app`, same as the web. No API keys in the app binary.
- Native features are exposed to the web app through a JavaScript bridge with an allow-list of methods. The web app must work fully when the bridge is absent (desktop browser).
- Every agent action is user-initiated or user-approved. Irreversible actions (send message, place call) always show a confirm step unless the user has enabled auto-approve for that action.
- The model never receives vault values. It emits intent + opaque references; the action executor resolves them on-device and returns a status string only.

## 4. Screens

The app has four screens plus system overlays, matching the web app.

| Screen | Content | Mobile notes |
|---|---|---|
| **Onboarding** | Intro to agent features, progressive permission consent, Pico Vault explanation | First run only. Every gate is skippable; features degrade gracefully |
| **Auth** | Email magic link form, guest continuation | First screen on cold start. Magic link opens inside the WebView through the auth subdomain |
| **Chat** | Same chat UI as web: sidebar, greeting, composer with mic | Sidebar becomes a drawer. Mic button uses the native bridge when available |
| **Profile** | Name, plan, voice minutes used, referral code, log out, delete account | Account deletion is required by Google Play |

**UI rules**

- The web app detects the app shell through `window.PicoBridge` and switches to the mobile layout.
- The splash screen shows the Pico logo on the brand background while the WebView loads.
- Back button: inside a chat, back goes to the previous view; on the chat root, back asks before exit.
- No pull-to-refresh conflicts: the WebView handles scroll; a custom refresh is not enabled.

## 5. JavaScript bridge

Methods exposed as `window.PicoBridge`. The web app checks `window.PicoBridge` exists before calling anything.

| Method | Direction | Purpose |
|---|---|---|
| `startVoiceInput(language)` | Web → Native | Opens the mic with Android `SpeechRecognizer` |
| `stopVoiceInput()` | Web → Native | Cancels the current recognition |
| `onSpeechResult(text, isFinal)` | Native → Web | Pushes partial and final transcripts into the composer |
| `onSpeechError(code)` | Native → Web | Reports mic errors so the UI can fall back to typing |
| `share(text)` | Web → Native | Opens the Android share sheet |
| `openExternal(url)` | Web → Native | Opens a URL in the device browser |
| `getAppVersion()` | Web → Native | Returns version name/code for the profile screen |
| `hasCapability(feature)` | Web → Native | Reports which permissions/access are granted |
| `requestAccess(feature)` | Web → Native | Launches the consent flow for a gated feature |
| `performAction(action, refs)` | Web → Native | Runs an agent action; `refs` are vault IDs, never raw values |
| `onActionResult(id, status)` | Native → Web | Reports success/failure/cancelled — never action content |
| `vaultSet(key, value)` / `vaultHas(key)` | Web → Native | Stores or checks a secret without the model seeing it |
| `setShield(rules)` | Web → Native | Configures distraction-shield surfaces per app |

**Voice bridge behavior**

- `SpeechRecognizer` runs on the main thread with `RecognitionListener`. Partial results stream to `onSpeechResult` with `isFinal=false`; the final result sends `isFinal=true`.
- Silence timeout and barge-in are handled on the web side; the bridge only reports speech events.
- If `SpeechRecognizer` is unavailable or the permission is denied, `onSpeechError` fires and the web UI shows the typed fallback.
- Transcribed text goes through the normal composer. Audio never leaves the device.

## 6. Device actions (agent layer)

| Action | Mechanism | Gate |
|---|---|---|
| Place a call | `Intent.ACTION_CALL` | `CALL_PHONE` runtime permission — **v1** |
| Open an app | `getLaunchIntentForPackage` | none — **v1** |
| Share text to WhatsApp (composer prefilled, user taps send) | Share intent / `ACTION_SEND` | none — **v1** |
| Set alarms and timers | `AlarmClock` intents | none — **v1** |
| Whole-app shield (overlay when a blocked app opens) | `UsageStatsManager` foreground polling + `TYPE_APPLICATION_OVERLAY` | Usage access + `SYSTEM_ALERT_WINDOW` — **v1** |
| Send a WhatsApp message (open chat, fill text, tap send) | `AccessibilityService` selector automation — full send, no user tap required | Accessibility enabled by user — **v3** |
| Fill/tap flows inside third-party apps | `AccessibilityService` gestures and node actions | Accessibility — **v3** |
| Surface shield: cover Reels/Shorts-style surfaces while leaving messaging usable | Accessibility window events detect the surface; `TYPE_ACCESSIBILITY_OVERLAY` masks it | Accessibility + `SYSTEM_ALERT_WINDOW` — **v2** |
| Foreground-app detection (precise) | `onAccessibilityEvent` package callbacks | Accessibility — **v2** |
| Read incoming notifications | `NotificationListenerService` | Special access — **v2** |

**Rules**

- Actions execute fully on-device. The model sends intent + vault references; the executor resolves and performs them locally.
- If a target app's UI changed and automation fails, the action degrades to "finish this step manually" — the app never guesses blindly.
- Automation is selector-based (node IDs, text, hierarchy) — never raw x/y coordinates, so screen size and layout changes do not break it.
- Automation recipes are maintained per target-app version/locale/OEM: recipes for the most-used devices and layouts ship first, and selectors refresh through minor updates and remote config so a WhatsApp update does not leave the action broken for long.
- Action telemetry (device model, target-app version, success/failure — never message content or screen text) shows which layouts need the next recipe update.
- Irreversible actions confirm with the user first (send, call, delete). Repeat actions can be auto-approved per-action-type in settings.
- Shield rules are user-configurable per app: the user chooses which apps and which in-app surfaces get the overlay. Presets ship for Reels, Shorts, and the TikTok feed; the user can add any distracting surface in any app.

**Capability boundary**

The agent can do what a user can do with a finger on the screen — nothing more:

- Only UI-level control: the agent taps, types, and reads what is on screen. It cannot call a third-party app's private APIs or access its internal data.
- `FLAG_SECURE` screens (banking, payments, DRM video) are invisible to accessibility — the agent can neither read nor tap them. Password fields always arrive masked.
- Automation needs the target app in the foreground with the screen on; there is no silent background control of other apps.
- No system/root-level control: cannot modify or uninstall other apps or change deep system settings.
- Actions run at roughly human speed (sequential UI steps), not API speed.
- OEM behaviour varies: some manufacturers (Xiaomi/Oppo/Vivo) aggressively kill accessibility services and overlays — a first-class testing concern.

## 7. Onboarding and permission consent

- Progressive consent screens during onboarding — each gate explains why Pico needs it and what Pico does **not** do with it.
- Agentic mode arrives with the v2 update and stays dormant until the user opts in through a dedicated consent screen with its own ToS plus the system permission grants; v1 users see only the normal app under the normal ToS.
- The agent code is part of the installed bundle — Play policy forbids downloading executable code outside Play's update mechanism, so "module download" means feature **activation**, not a code download.
- Order: accessibility (core agent), overlay (shield), usage access (fallback detection), mic (voice), phone (calls), contacts (vault resolution).
- Every gate is skippable. Skipping disables only that feature; the rest of the app works.
- A dedicated settings screen re-opens any gate later.
- A prominent disclosure runs before enabling accessibility, as required by Play policy.

## 8. Pico Vault

The vault is Pico's privacy boundary — the `.env` file for the AI. Functions can use secrets; nobody reads them.

- **Storage:** Android Keystore-backed encrypted store on-device (SQLCipher or `EncryptedFile`).
- **Sync decision:** v1 is strictly local — nothing leaves the device. An opt-in encrypted backup (client-side encrypted, keys held by the user) is a post-beta feature.
- **References, not values:** the model works with opaque IDs (`contact:ref_7f3`, `note:ref_91c`). It emits e.g. `send_whatsapp(contact:ref_7f3, body:ref_1ab)`; the executor resolves refs locally and the model only sees `sent`.
- **Masked rendering:** vault values render inside masked/blur components. Sensitive surfaces get `FLAG_SECURE` so screenshots and recents thumbnails show nothing. On the web side, vault fields are protected elements with copy/paste disabled.
- **Scope:** covers contacts, message bodies, credentials, personal identifiers, and anything the user marks private. Vault data never enters model context, logs, analytics, crash reports, or the backend.
- **Honest boundary:** the `AccessibilityService` technically can read on-screen text to perform actions — that is how automation works. The vault guarantee is architectural, not a hardware promise: captured data is processed on-device only, is never persisted outside the vault, and never leaves the device. The agent and vault layer stays minimal and auditable so this guarantee can be verified.

## 9. Authentication and sessions

- The WebView shares the session cookie on the `.askpico.app` domain, so sign-in persists between the app and the browser.
- Guest continuation creates an anonymous Supabase session, same as web.
- Magic links must open inside the app, not the default browser. Configure the app link intent filter for `auth.askpico.app` so the link resumes in-app.
- The app keeps the session until the user logs out; there is no forced re-login.

## 10. Deep links and referral

- Intent filter for `https://askpico.app/*` and `https://go.askpico.app/*`.
- A `?ref=<code>` link opened on the device routes into the app and pre-fills the referral code at signup, matching the web flow.
- Weekly Pass and coupon checkout always opens the web checkout page in the device browser — server-validated, Stripe-style sessions — never inside the app's WebView, so a modded app build cannot fake purchase state.

## 11. Permissions

| Permission | Why | Notes |
|---|---|---|
| `INTERNET` | Required for the WebView | Always granted |
| `RECORD_AUDIO` | Voice input | Runtime permission with prominent disclosure |
| `CALL_PHONE` | Place calls on user command | Runtime permission with disclosure |
| `READ_CONTACTS` | Vault resolves names to numbers locally | Runtime; contacts stay on-device |
| `POST_NOTIFICATIONS` | Action status and shield reminders | Runtime (Android 13+) |
| `SYSTEM_ALERT_WINDOW` | Distraction-shield overlay | Special access, granted in Settings |
| `PACKAGE_USAGE_STATS` | Foreground-app fallback detection | Special access (Usage access) |
| Accessibility service | UI automation and surface detection | Enabled in Settings; Play declaration required |

## 12. Offline and errors

- No network: a native error screen offers Retry and Open in browser.
- Slow network: the WebView shows its own loading state; the splash is only for cold start.
- WebView crash: the app recovers by reloading the last URL.

## 13. Build and release

- Android Studio project in `apps/mobile/` with Gradle and Kotlin.
- Release artifact is an `.aab` uploaded with Play App Signing.
- Target the latest required API level at submission time.
- Minimum SDK is API 24 (Android 7.0) so the app runs on devices 7–8+ years old; verify accessibility and overlay behaviour there early.
- Beta and v1 ship without `AccessibilityService` for fast approval; the v2 update adds the dormant agent module, and agentic mode activates through the in-app opt-in (separate ToS + system permission grants), so a single listing serves both normal and agent users.
- Track order: internal testing for the beta cohort, then closed testing, then production.
- Naming: the Play listing keeps one app name (Pico). "Beta" is the track, not the name — testers join via an opt-in link and see the same listing. `versionName` marks the build: beta builds use `1.0.0-beta.N`, the production release uses `1.0.0`, and later phases continue `1.1.0` (v2), `1.2.0` (v3).
- A new personal developer account needs a closed test with at least 12 opted-in testers for 14 days before production unlocks.

## 14. Google Play checklist

The full mandatory list lives in the [Beta launch](../product/beta-launch.md) section 8. App-specific items:

- In-app account deletion and a public web deletion link.
- Mic permission disclosure before the first recording.
- Beta and v1 need no accessibility declaration — the build contains no `AccessibilityService`. The declaration lands with the v2 update.
- Accessibility API declaration form with a demo video showing the agent and shield working (v2).
- The declaration describes the agent as dormant-by-default: it activates only after the in-app opt-in consent and the user's own system permission grants.
- Prominent disclosure before enabling accessibility, and justification that the agent is core functionality — not a workaround.
- Data safety form entries that match reality: contacts, usage, and vault data marked as on-device only, not shared.
- At least one native feature beyond a plain web wrapper: the voice bridge, agent actions, and shield all count.
- Fallback plan: if Play rejects the accessibility declaration, ship a reduced build (shell + voice) to Play and distribute the full agent build through a side channel.

## 15. Milestones

| Step | Phase | Work | Done when |
|---|---|---|---|
| A1 | Beta | Kotlin shell, WebView, splash, back handling | App opens Chat over HTTPS on a device |
| A2 | Beta | Session and auth | Guest and magic-link sign-in work inside the app |
| A3 | Beta | JS bridge core | `share`, `openExternal`, `getAppVersion` callable from the web app |
| A4 | Beta | Voice bridge | Spoken input lands in the composer; error falls back to typing |
| A5 | Beta | Onboarding consent flow | Every gate explainable, skippable, and re-openable in settings |
| A6 | Beta | Pico Vault | Secrets resolve through actions without entering model context, logs, or network calls |
| A7 | Beta | Intent actions + whole-app shield | Call/app-open/WhatsApp-prefill work; overlay blocks user-picked apps |
| A8 | Beta | Polish and store prep | Screens pass on low-end devices; listing and disclosure assets ready |
| A9 | Beta | Internal testing build | `.aab` uploaded; testers complete the permission flow |
| A10 | v1 | Production release | Beta feature set ships to production, hardened |
| B1 | v2 | Accessibility service + declaration assets | Service runs on reference devices; declaration and demo video ready |
| B2 | v2 | Agentic-mode opt-in activation | Consent flow turns the dormant module on |
| B3 | v2 | Surface shield | Reels/Shorts-style surfaces blocked inside allowed apps |
| B4 | v2 | Notification reading + auto-approve rules | Notifications surface in-app; repeat actions can auto-run |
| C1 | v3 | WhatsApp full automation | Selector recipes send a message end-to-end on reference devices |
| C2 | v3 | Third-party app flows + recipe infra | Remote-config recipe updates; telemetry shows layout coverage |
| C3 | v3 | Encrypted vault backup | Opt-in backup restores vault on a new device |

## 16. Testing

- Devices: one low-end Android (4 GB RAM) and one mid-range, both on the minimum supported Android version.
- Scenarios S3, S16, and S18 from the [Beta launch](../product/beta-launch.md) section 5.
- Voice: dictation works in the app, permission denial shows the typed fallback, and quota blocks at the limit.
- Agent: WhatsApp send end-to-end, call intent, shield toggling per surface, and every permission-denial path.
- Vault: verify no secret value appears in logs, network payloads, model context, or screenshots (`FLAG_SECURE`).
- Network: airplane mode, captive portal, and a dropped connection mid-session.

## 17. Risks

- **Play accessibility review (deferred to v2):** beta and v1 contain no `AccessibilityService`, so approval risk is minimal. The v2 update needs the declaration, prominent disclosure, and demo video, backed by the dormant-by-default opt-in design. Fallback: keep the accessibility module out of the Play build and deliver it through a side channel.
- **UI automation fragility:** WhatsApp and Instagram layouts change per version and OEM. Mitigate with selector-based recipes (no coordinates), remote-config recipe updates, telemetry-driven prioritisation, and a "finish this step manually" fallback.
- **Overlay restrictions:** Android 12+ tightens overlay and untrusted-touch rules. Test shield behaviour on target API levels early.
- **Vault trust gap:** accessibility can technically read screen text; the promise is on-device-only processing. Mitigate by keeping the agent/vault layer minimal, auditable, and free of analytics on accessibility events — and consider publishing it for external review.
- **WebView speech gap:** covered by the native bridge; verify `SpeechRecognizer` on target devices early.
- **WebView updates:** the app depends on the device WebView version; test on older WebView builds.
- **Magic link deep-linking:** misconfigured intent filters open the browser and break sign-in. Test the link flow end to end.

## 18. Open questions

- None outstanding for beta — Play strategy resolved: beta/v1 without accessibility, v2 adds the dormant opt-in agent module (see sections 2, 7, and 14).

## 19. Beta implementation plan (remaining work)

Onboarding (A5) is deferred. Everything else in beta is built in the phases below, in dependency order. Each phase ends with a working, testable build.

**Status (implemented, compiles; device testing pending):**

- Phase 0: `Capabilities`, `hasCapability`, `requestAccess`, `performAction` bridge.
- Phase 1: `ActionExecutor` for `open_app`, `open_url`, `set_alarm`, `set_timer`, `share_whatsapp`, `call` (confirm dialog, masked number).
- Phase 2: `VaultStore` (`EncryptedSharedPreferences`, `MasterKeys` AES256-GCM), `vaultSet`/`vaultHas`, on-device ref resolution in `ActionExecutor`.
- Phase 3: `ShieldRules` (validated, persisted), `ShieldService` (foreground service, usage polling, overlay), `setShield`.
- Phase 4: `apps/web/src/utils/nativeAgent.ts` bridge wrapper with `window.PicoAction.onResult` listener, Settings > Agent section (`AgentSettings`) for permissions, shield presets, and private details. Action triggers from chat are not wired yet.
- Onboarding (A5) and FCM (external Firebase config) remain out of scope for this pass.

**Bridge contract (applies to all phases)**

- `performAction(action, refsJson)` returns `{"id","status":"queued"}` or `{"id","status":"unsupported"|"denied"|"invalid"}` synchronously.
- The final result is posted to the web as `window.PicoAction.onResult(id, status)`. Status only, never action content.
- Irreversible actions show a native confirm dialog before running.

**Phase 0: Bridge foundation (A3 completion)**

- Add a `agent/` package with an `ActionExecutor` and an `ActionResult` type.
- Implement `hasCapability(feature)` by checking the matching runtime permission or special access.
- Implement `requestAccess(feature)`: runtime permissions go through the system prompt directly. Special access (overlay, usage) opens the matching Settings screen.
- Done when: `hasCapability` returns true/false correctly for each feature, and `requestAccess` shows the system prompt or opens Settings.

**Phase 1: Intent actions (A7, part 1, no permissions except call)**

- `open_app(package)`: launches via `getLaunchIntentForPackage`. Missing app returns `unsupported`.
- `open_url(url)`: `https`/`http` only, opens in the device browser.
- `set_alarm(hour, minute, label)` and `set_timer(seconds, label)`: `AlarmClock` intents with `SKIP_UI` where supported.
- `share_whatsapp(text)`: `ACTION_SEND` with `setPackage("com.whatsapp")`. The user taps send. Falls back to the generic share sheet if WhatsApp is missing.
- `call(number)`: `ACTION_CALL` with the `CALL_PHONE` runtime permission, plus a native confirm dialog. (Open decision D5 is resolved here: `ACTION_CALL`, per section 6.)
- Refs are rejected with `invalid` until Phase 2.
- Done when: each action works on a device, the call confirm and denial paths work, and a log sample contains no argument values.

**Phase 2: Pico Vault (A6)**

- Store: `androidx.security:security-crypto` `EncryptedSharedPreferences`, keyed by the Android Keystore. Strictly local, no backup (`allowBackup=false` is already set).
- `vaultSet(key, value)` and `vaultHas(key)` are implemented. There is no vault read method on the bridge.
- `ActionExecutor` resolves `refs` (`contact:ref_…`, `note:ref_…`) on-device. The result returns `sent` or a status, never the value.
- `FLAG_SECURE` is set on any native screen that shows vault values.
- Done when: a secret resolves through `share_whatsapp` without entering the web payload, logs, or network calls. Verify with logcat and a proxy capture.

**Phase 3: Whole-app distraction shield (A7, part 2)**

- `ShieldService`: a foreground service that polls `UsageStatsManager` events every ~1 s and detects `MOVE_TO_FOREGROUND`. Blocked packages get a `TYPE_APPLICATION_OVERLAY` with a "Back to Pico" button. Pico's own package is never blocked.
- Rules are persisted in `SharedPreferences`. `setShield(rulesJson)` validates and stores them, and starts or stops the service.
- Needs `PACKAGE_USAGE_STATS` (Usage access settings) and `SYSTEM_ALERT_WINDOW` (`ACTION_MANAGE_OVERLAY_PERMISSION`). Both are checked through `hasCapability`.
- Declare the foreground service type in the manifest and verify it against the Play foreground service policy before the internal test build.
- Done when: a blocked app opens the overlay within about 1 s, the overlay clears on Home, and toggling a rule off removes the block without a restart.

**Phase 4: Web integration (UI for the bridge)**

- Settings > Agent section (web, `apps/web`): capability status from `hasCapability`, grant buttons from `requestAccess`, and a shield rules editor. Beta presets are whole-app packages (Instagram, YouTube, TikTok). Reels/Shorts surface presets are v2.
- Vault UI: masked fields with copy disabled. Values are written with `vaultSet` and never read back into the web state.
- Action triggers: beta has no model-to-device path yet. The first trigger is a user-visible action in the chat UI. Model-emitted actions are a separate design step.
- Profile: web Settings > Account already covers plan, referral, logout, and delete. A native Profile screen is not needed for beta unless the web settings page fails the mobile layout check.
- Done when: every bridge method has a web caller that is gated by `window.PicoBridge` and works when the bridge is absent.

**Phase 5: Release hardening (A8 to A9)**

- Test on one 4 GB low-end device and one mid-range device, both on minSdk 24 / API 24 behaviour.
- Test every permission-denial path, airplane mode, and a dropped connection.
- Check the Play data safety entries (contacts, vault, usage marked on-device only).
- Build the signed `.aab` with `versionName` `1.0.0-beta.N`, then upload to internal testing.

**External dependencies (not started until provided)**

- FCM push (A-push): needs a Firebase project and `google-services.json` from the product owner. Announcement broadcasts only.

**Order**

Phase 0 → 1 → 2 → 3 → 4 → 5. Phase 1 needs only Phase 0. Phase 2 must land before any action uses refs. Phase 3 is independent of Phase 2 and can run in parallel.
