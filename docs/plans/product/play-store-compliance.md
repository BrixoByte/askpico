# Play Store Compliance Plan

**Status:** Planning
**Owner:** Pico product team
**Platforms:** Android (Kotlin WebView shell). Web items are listed only where Play policy touches them.
**Related:** [Beta launch](beta-launch.md) · [Feature catalog](feature-catalog.md) · [Android app](../engineering/android-app.md) · [Database](../engineering/database.md) · [Data protection](../security/data-protection.md) · [Authentication](../engineering/authentication.md)

## 1. Purpose

This document maps Google Play Developer Program Policies to Pico's features. It lists what must change, what is open, and what must be checked in Play Console before submission. The beta scope stays in [Beta launch](beta-launch.md). Items here that change scope are listed in section 9.

## 2. Policy Map

| Policy | Pico impact | Required action | Status |
|---|---|---|---|
| Payments | Beta paid plans use a NayaPay QR popup and a manual plan flag. On Android this leads users to another payment method, which the policy prohibits | Android paid features must use Google Play Billing. See section 3 and decision D1 | Open (violation risk) |
| Subscriptions | Pro Monthly is recurring, so a subscription is valid. Weekly Pass is a one-time benefit and must be an in-app product | Show price, billing cycle, auto-renew, and whether a subscription is required before purchase. Add a cancel link in account settings | Open |
| Ads | No ads are planned in the beta | None now. If ads are added, review Ads, Families, and Inappropriate Ads policies | Not applicable |
| AI-Generated Content | Text chat, image generation, and artifacts are AI-generated content | In-app report or flag on every AI output. Restricted-content prevention. See section 5 | Not in beta docs |
| Content Ratings | Mandatory IARC questionnaire. AI output can change the rating | Answer honestly in Play Console. Repeat the questionnaire when AI or artifact features change | Not started |
| SDK Requirements | Supabase, FCM, Google sign-in and Drive sync, and `esbuild-wasm` | Each SDK's data use must match the Data safety form. See section 6 | Not started |
| Permissions | Usage access and overlay for the whole-app shield. Microphone (`RECORD_AUDIO`) removed in round 63 (text-only beta) — remove the Play permission declaration if present | Confirm the Play permission declaration for usage access and overlay in Play Console | Verify |
| Device and Network Abuse, Unauthorized Use or Imitation of System Functionality | Whole-app shield draws overlays over other apps | Overlay must be dismissible and must not imitate system UI. Confirm the rules in Play Console | Verify |
| Impersonation and Intellectual Property | Chibi character is original | Do not copy existing anime characters (already in beta scope) | OK |
| Deceptive Behavior and Misrepresentation | Early-buyer coupons and pricing claims | Store listing must match in-app prices and offers. No "unlimited" claims that the plan does not give | Review |
| Spam, Functionality, and User Experience | Beta bridges are stubs (`performAction`, `setShield`, `vaultSet`/`vaultHas`) | Do not ship a visible feature that does nothing. Hide or finish each one before submission | Open |
| User Data and Account Deletion | Account deletion (web and Android) is already in beta scope | Keep the public web deletion link and the in-app flow | In scope |
| Health Content and Services | Doctor agent is planned, not in beta | If the Doctor agent ships, review this policy first | Not applicable |
| Target API Level | Build must target the level Play requires | Check the current requirement in Play Console before each release | Verify |

## 3. Google Play Billing (Android)

### 3.1 Library version

- Play Billing Library **8 or later** is required for new apps and updates. The deadline was 31 Aug 2026, and the extension ended 1 Nov 2026. Use the latest release, currently **9.1.0** according to the release notes.
- Pico's minSdk is 24. The Billing Library 8.1.0 notes list minSdk 23, so 24 is compatible.

### 3.2 Products

| Benefit | Play product type | Notes |
|---|---|---|
| Pro Monthly | Subscription (`ProductType.SUBS`) | Recurring value. Auto-renew and cancel link required |
| Weekly Pass | Consumable one-time product (`ProductType.INAPP`) | Consume after grant so it can be bought again. Not a subscription |
| Early-buyer offer (50% off 3 months) | Play offer or promo code | Format to confirm (decision D3) |

### 3.3 Purchase flow

1. Create `BillingClient` with `enablePendingPurchases(PendingPurchasesParams ... enableOneTimeProducts())` and `enableAutoServiceReconnection()`.
2. Query product details, then launch the billing flow from the main thread.
3. Handle `onPurchasesUpdated`. Grant access only when the purchase state is `PURCHASED`. Do not grant on `PENDING`.
4. Verify the purchase token on the backend (`services/api`) through the Google Play Developer API before granting the plan. Store the purchase token, order ID, product ID, and state.
5. Acknowledge subscriptions and non-consumables within 3 days. Consume consumables after the grant is saved.
6. For rejected or unfulfilled purchases, do not acknowledge or consume. Revoke and refund from the backend.
7. Call `queryPurchasesAsync` on app resume to catch purchases made while the app was closed.
8. Suspended subscriptions (paused or payment declined) give no access. Query with the suspended-subscriptions option enabled.

### 3.4 Backend and data

- Add a billing endpoint in `services/api`. It must be the only path that sets a paid plan on Android.
- Real-time Developer Notifications (Pub/Sub) keep renewals, cancellations, and refunds in sync.
- The billing tables are new data storage. Add them to [Database](../engineering/database.md) per the docs conventions.

### 3.5 Profile page

- Show plan status and a link to Play's subscription center for cancel and manage actions (Profile is already in beta scope).

## 4. Alternative Billing and Web Payments

- Playing it safe on Android: no NayaPay popup, no external payment link, and no plan purchase buttons that lead outside Play inside the WebView.
- The web app may keep the NayaPay flow, since Play policy covers the Android app. Confirm this with Play policy before web and Android share one codebase.
- `getBillingConfigAsync` returns the user's Play country. Do not store that value or use it for profiling.
- Alternative billing programs exist for some regions. Eligibility must be checked in Play Console before use.

## 5. AI-Generated Content and Safety

- **Report or flag:** every AI text reply, generated image, and artifact needs an in-app report action that works without leaving the app. The Android WebView must show it too.
- **Restricted content:** prevent generation of child exploitation content, deceptive content, and other restricted categories. Add server-side filters and prompt guardrails. The current mood-tag guardrail covers display only.
- **Moderation loop:** use reports to tune filters. Define who reviews reports and how fast.
- **Artifacts:** generated apps run in a sandboxed iframe (already in place). Treat them as AI output for reporting.

## 6. SDKs and Data Safety

Keep this list in sync with the Play Console Data safety form.

| SDK or service | Data | Used for |
|---|---|---|
| Supabase | Email, name, plan, referral, usage counts, memory (`user_brain`) | Auth, database, memory sync |
| Firebase Cloud Messaging | Device push token | Push notifications |
| Google sign-in and Drive | Google account, Drive files (opt-in) | Drive sync |
| Android `SpeechRecognizer` | Audio (on device) | Voice input |
| `esbuild-wasm` | Artifact code (in browser) | Artifact bundling |
| Google Play Billing | Purchase token, order ID, product ID | Paid plans |

- Check each SDK version's own Play policy and data handling.
- Voice audio stays on the device in the current pipeline (already in beta scope), which keeps the form small.

## 7. Content Rating

- Complete the IARC questionnaire in Play Console with accurate answers about AI chat, generated images, artifacts, and user-generated content.
- Repeat the questionnaire whenever those features change.
- No ads at beta, so ad-content rules do not apply yet.

## 8. Pre-Submission Checklist

- [ ] Play Billing integrated with server verification (section 3).
- [ ] Weekly Pass and Pro Monthly configured as in-app product and subscription.
- [ ] Subscription cancel link in Profile.
- [ ] No external payment path inside the Android app.
- [ ] Report or flag on all AI output (web and Android).
- [ ] Restricted-content filters in place and tested.
- [ ] IARC questionnaire complete.
- [ ] Data safety form matches section 6.
- [ ] Permission declarations complete for usage access and overlay.
- [ ] Shield and other bridge stubs either finished or hidden.
- [ ] Store listing prices and offer claims match the app.
- [ ] Privacy policy and web account deletion link live.
- [ ] Target API level meets the current Play requirement.

## 9. User Data, Permissions, and Sensitive APIs

Summary of the policies that cover user data, permissions, and special access. Confirm each permission declaration in Play Console before submission.

| Policy | Pico impact | Required action | Status |
|---|---|---|---|
| Persistent identifiers | No IMEI, SSAID, or Advertising ID is needed. No analytics or ads SDK is planned | Never link a persistent device ID to a user account or personal data. Review whether the FCM token is linked to accounts | Verify |
| Personal and sensitive user data | Account, chat content, memory, and the app list used by the shield are all sensitive | Collect only what each feature needs. Never sell or share for ads | Open |
| Prominent disclosure and consent | Needed before the usage access, overlay, and notification permissions | In-app disclosure shown before each system prompt. Consent by an affirmative tap. Do not treat back or home as consent. No auto-dismiss | Open |
| Restricted permissions | Shield uses `PACKAGE_USAGE_STATS` (special access) and `SYSTEM_ALERT_WINDOW` (settings page) | Honour a decline. Give a non-blocking fallback. Explain each permission in context | Open |
| Intent actions (calls) | Direct call needs `CALL_PHONE`, a dangerous permission with a runtime request | Prefer `ACTION_DIAL`, which needs no permission and lets the user confirm. See decision D5 | Decision |
| Alarms and timers | Timers can use the system clock app through an intent | Do not declare `USE_EXACT_ALARM` or `SCHEDULE_EXACT_ALARM`. Pico's core is not alarms | Planned |
| Package visibility | The shield needs the installed-app list for user picks | Use targeted package queries, not `QUERY_ALL_PACKAGES` | Verify |
| Accessibility API | Not in beta. The v2 plan has an agentic module and surface shield. The v3 plan has WhatsApp automation | Policy forbids the API for autonomous decision-making agents and for bypassing security controls. Review before v2 starts. See decision D6 | Blocking for v2 and v3 |
| Third-party AI processing | User messages go to Gemini and OpenRouter | Disclose these processors in the privacy policy. They must not sell data. Keep free OpenRouter models off user data unless confirmed | Open |
| Age Signals API | Not used | Revisit only if a law requires age checks | Not applicable |
| Location, SMS and call logs, all-files access, Health Connect, body sensors, VPN, full-screen intent, install packages | Not used | None | Not applicable |

## 10. Open Decisions

| ID | Question | Options | Owner |
|---|---|---|---|
| D1 | How do Android paid plans work? | (a) Play Billing only, and hide NayaPay on Android. (b) Hide plan purchase on Android for beta. | Product |
| D2 | Is Weekly Pass a consumable or removed? | (a) Consumable in-app product. (b) Remove from beta | Product |
| D3 | How is the early-buyer offer delivered on Android? | (a) Play offer. (b) Promo code. (c) Web only | Product |
| D4 | Do the Shield and Intent actions ship in beta? | (a) Keep and verify declarations. (b) Move to v1 | Product |
| D5 | How does the call action work? | (a) `ACTION_DIAL`, no permission, user confirms. (b) `ACTION_CALL`, with `CALL_PHONE` runtime request | Product |
| D6 | How do the v2 agentic and v3 WhatsApp automation plans comply with the Accessibility API policy? | (a) Policy review before v2. (b) Drop autonomous agent features | Product |

Once D1 to D4 are decided, update [Beta launch](beta-launch.md) section 2 and section 10.
