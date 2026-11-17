# Round 31 — Task 10: store/legal prerequisites (read-only audit)

| Requirement | Status | Notes |
|---|---|---|
| Target API current | PASS | targetSdk 34, compileSdk 34, minSdk 24 (`app/build.gradle.kts`). |
| Manifest permissions | PASS | INTERNET, ACCESS_NETWORK_STATE, RECORD_AUDIO, CAMERA, CALL_PHONE, POST_NOTIFICATIONS, SET_ALARM (added R31 — clock intents were failing without it), SYSTEM_ALERT_WINDOW, FOREGROUND_SERVICE + SPECIAL_USE, PACKAGE_USAGE_STATS, storage ≤28. Queries for WhatsApp/IG/YT/TikTok/FB/Chrome. |
| Mic disclosure/consent | PASS | Runtime permission prompt + consent copy in auth flow (verified R30; unchanged). |
| Privacy policy URL reachable in-app | PASS (fixed) | Auth page had `${marketingOrigin()}/privacy.html` + `terms.html`; Settings had none. Added a **Legal** block under Settings > Account (Privacy Policy, Terms of Service) using shared `marketingOrigin()` moved into `utils/authRoutes.ts`. |
| Terms of service URL | PASS (fixed) | Same block. |
| Public account-deletion path | PARTIAL | In-app delete-account dialog exists (Settings > Account, signed-in). **No dedicated public deletion-request web page found** on marketing site — owner item: publish `askpico.app/delete-account` (or section) for Play's account-deletion requirement. |
| Data Safety declarations | OWNER ITEM | Cannot be verified from repo; must be declared in Play Console (mic audio, personal info, app activity). |
| Content rating / audience / ads / category | OWNER ITEM | Play Console declarations; not in repo. |
| Signed AAB + Play App Signing | OWNER ITEM | Debug/staging APK used for testing; release signing is a store-step. |
| Store listing assets + support email | OWNER ITEM | Not in repo. |
| Native functionality beyond WebView | PASS | Bridge exposes intent actions, shield overlay (foreground service), encrypted vault, native confirms — substantial native surface, satisfies "not just a WebView". |

## Edit made
- `apps/web/src/utils/authRoutes.ts` — added `marketingOrigin()` export.
- `AuthPage.tsx` — now imports `marketingOrigin` from `authRoutes`.
- `SettingsMenu.tsx` — new Legal block (Privacy/Terms) under Account, 48dp links.
