# Beta Progress Tracker

**Last updated:** Round 32 (2026-11-17)
**Source:** [Beta launch](beta-launch.md) sections 2 and 11, and [Beta test plan](beta-testing.md) Phases 0–9.
**Status key:** DONE · PARTIAL · NOT DONE · BLOCKED
**Rules:** Update at the end of every round. Evidence is a test name, screenshot or report path, or commit id. Lines marked "code" were checked in code only, not on a device or in a browser.
**Test creds:** `TEST_PASSWORD` not set in the owner shell this round. All signed-in tests are Not verified.

## Doc drift (fix in docs, not code)

| # | Drift | Where | Owner decision |
|---|---|---|---|
| D-1 | Auth host listed as `auth.askpico.app`, while §8 says the app host is `go.askpico.app` and `chat.askpico.app` has no DNS. Local §8.1 and beta-testing still use `chat.localhost` for the app | beta-launch §3.1 table, §4.7 CORS line, §8.1 session sharing, §11 line 408; beta-testing §0 and §1.1 | yes: confirm `go.` is the single app host and whether `auth.` stays a separate host |
| D-2 | Guest voice rule. §11 says voice is restricted to signed-in accounts (server 403 for guests). beta-testing §3 says the same. Code and UI use a **2-minute guest voice trial** (`GUEST_VOICE_LIMIT`, `guest_trial_grants`, "Voice trial: 2:00 left"). §4.1 has no guest rule | beta-launch §11 "Voice mode and voice endpoints restricted", beta-testing §3 "Guest voice" | yes: pick the rule (2-min trial or 403) and update §11, §4.1, and beta-testing §3 |
| D-3 | Scope §2 says "No AccessibilityService in the build". Option A (Part 2 of Round 32) would change this and D6 | beta-launch §2 Android row, §10 D6 | yes: decide option A |
| D-4 | §11 "Chat action triggers" is unticked, but Round 31 device-tested them (CHAT_TRIGGERS.md) | beta-launch §11 Android | no: tick it |
| D-5 | §11 shield and vault rows still say "device testing pending". Round 31 tested them on device | beta-launch §11 Android | no: update the text |
| D-6 | §11 Referral says bonus minutes are "not yet enforced since voice quota (Step 5) is pending", but Step 5 is unticked and the guest trial code exists. Needs a check | beta-launch §11 Referral and Voice | no: verify then update |
| D-7 | beta-testing has Phases 0–8 plus an unnumbered sweep (labelled 9). **Phases 10 and 11 do not exist** | beta-testing | yes: confirm whether 10 and 11 were planned or removed |

## Section 2 (scope)

| Item | Status | Evidence | Owner decision | Next action |
|---|---|---|---|---|
| Voice mode (Steps 1–6) | PARTIAL | Step 5 unticked (see §11). Browser voice not retested this round | no | Device voice pass after D-2 is settled |
| Model auto-routing and modes | PARTIAL | §11 routing ticked (code). Live routing not retested this round | no | Run S6/S8 once a test account is available |
| Persona system | PARTIAL | §11 ticked (code). S12/S13 not run | no | Phase 6.1 run |
| Chibi character and animation | NOT DONE | §11 unticked | no | Build character (§4.4) |
| Authentication (guest, email, sign-in) | PARTIAL | Guest: START_FLOW.md (R31). Email and password sign-in: not tested, no `TEST_PASSWORD` | yes: D-1 | Run signed-in tests when `TEST_PASSWORD` is set |
| Plan limits and early-buyer offer | PARTIAL | §11 manual billing ticked (code). S14, S20 not run | no | Phase 7 run |
| Referral (optional code) | PARTIAL | §11 ticked (code). S15 not run | no | Phase 7 run |
| Personalized memory (Layers 1–2) | PARTIAL | §11 ticked (code). Phase 2 not run | no | Phase 2 run |
| Android native agent layer | PARTIAL | Intent actions and vault DONE on device (INTENT_ACTIONS.md, VAULT.md, R31). Shield: per-app only (SHIELD.md) | yes: option A | Decide option A |
| API security baseline | PARTIAL | API tests 273 pass, 1 env-blocked, 2 todo (R31). Route-level auth tests not written (§11 open) | no | Write route-level auth tests |
| Pico Vault v1 (local) | DONE | VAULT.md (R31). Encrypted at rest, survives restart, no logcat or API leaks | no | none |
| Chat diagrams (Mermaid) | NOT DONE | §11 unticked | no | Build §4.8 |
| Response cache | NOT DONE | §11 unticked | no | Build §4.9 |

## Section 11 (Build Status)

| Item | Status | Evidence | Owner decision | Next action |
|---|---|---|---|---|
| Voice Step 1: mic insert | DONE | §11 ticked (code). Phase 5 not run on device | no | Phase 5 run |
| Voice Step 2: continuous listening | DONE | §11 ticked (code) | no | Phase 5 silence test |
| Voice Step 3: mood tags stripped | DONE | §11 ticked (code) | no | Phase 6.1 check |
| Voice Step 4: TTS chain | PARTIAL | §11 ticked (code). Fallback chain not run | no | Phase 5 fallback test |
| Voice Step 5: server voice quota and referral minutes | NOT DONE | §11 unticked. Guest trial exists (D-2) | yes: D-2 | Confirm rule, then build or mark |
| Voice Step 6: voice-to-voice loop | PARTIAL | §11 ticked (code). Barge-in not run | no | Phase 5 S11 |
| Routing: auto-routing across tiers | PARTIAL | §11 ticked (code) | no | S6/S7 run |
| Routing: fallback chain | PARTIAL | §11 ticked (code). S8 not run | no | S8 run |
| Routing: daily token cap | PARTIAL | §11 ticked (code) | no | Quota test |
| Guest daily message limit (30/day) | PARTIAL | §11 ticked (code). Phase 1 guest-cap check not run | no | Run guest cap test |
| Persona with mood tags | PARTIAL | §11 ticked (code) | no | Phase 6.1 run |
| Chibi character and animation | NOT DONE | §11 unticked | no | Build |
| Reduced motion support | PARTIAL | §11 ticked (code). S17 not run | no | Phase 6.2 run |
| Referral link and `?ref=` capture | PARTIAL | §11 ticked (code) | no | Phase 7 run |
| Referral reward after activity | PARTIAL | §11 ticked (code). Self-referral not run | no | S15 run |
| Memory: thread window (last 10) | PARTIAL | §11 ticked (code) | no | Phase 2 run |
| Memory: Global Brain sync | PARTIAL | §11 ticked (code) | no | Phase 2 run |
| Memory panel: view, delete, clear | PARTIAL | §11 ticked (code) | no | Phase 2 run |
| Guest continuation | DONE | START_FLOW.md (R31): guest relaunch, no auth flash | no | none |
| Email and password sign-up and sign-in | NOT DONE | Not tested: no `TEST_PASSWORD`, no auth-email budget | no | Run when creds are set |
| Sign-in gating for locked features | PARTIAL | §11 ticked (code). Gating seen on Android R31 (Settings sign-in sheet) | no | Web gating check |
| Voice restricted to signed-in (403 for guests) | NOT DONE | Conflicts with the 2-minute guest trial in code | yes: D-2 | Resolve D-2 |
| Account deletion (web) | PARTIAL | §11 ticked (code). Not run | no | Phase 7 S16 run |
| Account deletion (Android) | PARTIAL | §11 ticked (code). Not run | no | Phase 8 S16 run |
| Manual billing popup (NayaPay QR, coupons) | PARTIAL | §11 ticked (code). S20 not run | no | Phase 7 run |
| Manual plan flag set after payment | PARTIAL | §11 ticked (code). S14 not run | no | Phase 7 run |
| Web Chat page | PARTIAL | §11 ticked (code). Web device pass not run this round | no | Browser pass |
| Marketing site pages | PARTIAL | §11 ticked (code) | no | Phase 9 no-JS check |
| Marketing light/dark toggle | PARTIAL | §11 ticked (code) | no | Visual check |
| API: every user-data route needs verified session | NOT DONE | §11 unticked. Route-level tests missing | no | Write route-level tests |
| API: plan, quota, tier read from DB | DONE | §11 ticked (code). Quota policy tests pass (R31 API run) | no | none |
| API: account-scoped queries filter by user ID | NOT DONE | §11 unticked | no | Audit queries |
| API: session cookies (HttpOnly, Secure, SameSite=Lax) | NOT DONE | §11 unticked | no | Check cookie config |
| API: CORS allowlist (no `*`) | DONE | §11 ticked (code) | no | Phase 1 CORS curl run |
| API: rate limit every user-data route | DONE | §11 ticked (code). In-memory only (needs shared store before scale) | no | Shared store before multi-instance |
| API: body size and type validation | DONE | §11 ticked (code) | no | Phase 1 oversize test |
| API: PDF and DOCX server-side parsing | NOT DONE | §11 unticked | no | Build |
| API: user content escaped | DONE | §11 ticked (code) | no | none |
| API: parameterised queries everywhere | NOT DONE | §11 unticked | no | Audit |
| API: secrets backend-only | DONE | §11 ticked (code). Secrets filter test not run | no | Phase 1 secrets search |
| API: generic errors, no upstream bodies | DONE | §11 ticked (code) | no | none |
| API: submission logs field names only | DONE | §11 ticked (code) | no | none |
| API: logs hold IDs, tiers, codes only | NOT DONE | §11 unticked (not fully audited) | no | Log audit |
| API: backend auth and quota tests | PARTIAL | 93 security and quota tests pass. Route-level auth tests not written | no | Route tests |
| Mermaid rendering with pan and zoom | NOT DONE | §11 unticked | no | Build §4.8 |
| Mermaid chunk prefetch and fallback | NOT DONE | §11 unticked | no | Build |
| Exact-match response cache (24h) | NOT DONE | §11 unticked | no | Build §4.9 |
| Cache skips memory, attachment, voice | NOT DONE | §11 unticked | no | Build |
| Android: WebView shell and voice bridge | DONE | R30 and R31 device runs | no | none |
| Android: share and open-in-browser bridge | DONE | R30 device run | no | none |
| Android: intent actions | DONE | INTENT_ACTIONS.md (R31). Clock needed SET_ALARM | no | none |
| Android: whole-app shield | PARTIAL | SHIELD.md (R31). Per-app block works. Reel audio stop not measured. Option A pending | yes: option A | Decide option A |
| Android: Pico Vault | DONE | VAULT.md (R31) | no | none |
| Android: agent settings in web (Settings > Agent) | PARTIAL | Sign-in gated for guests, so not reached on device (R31). Bridge tested | no | Signed-in run |
| Android: native bridge `PicoAction.onResult` | DONE | R31 device run | no | none |
| Android: chat action triggers | DONE | CHAT_TRIGGERS.md (R31). §11 still unticked (D-4) | no | Tick §11 |
| Android: FCM push | BLOCKED | Needs Firebase project and `google-services.json`. Owner cloud item | yes | Owner to provide Firebase setup |
| Android: onboarding consent flow | NOT DONE | Deferred in §11 | no | Defer or build |
| Android: native Profile page | NOT DONE | §11 unticked. Web Settings covers it | no | Decide if needed |

## Phase 0–9 (beta-testing)

| Item | Status | Evidence | Owner decision | Next action |
|---|---|---|---|---|
| P0: backend health on `/api/tts/status` | DONE | Recorded 2026-11-10 in beta-testing. Not rerun this round | no | Rerun before next round |
| P0: no console errors on Landing, Auth, Chat | NOT DONE | Not checked this round | no | Browser console pass |
| P0: test accounts exist (Free, guest, paid) | BLOCKED | No `TEST_PASSWORD`. No auth-email budget | yes: set `TEST_PASSWORD` or create accounts | Owner to set env var |
| P1: S1 guest start | PARTIAL | Android guest start DONE (R31). Web Landing not run | no | Web run |
| P1: S2 guest to account | NOT DONE | Needs sign-in | no | Blocked on creds |
| P1: auth redirect to chat | NOT DONE | Needs sign-in. Host drift D-1 | yes: D-1 | Resolve D-1 |
| P1: sign-in gating (lock badge, modal) | PARTIAL | Android gating seen (R31). Web not run | no | Web run |
| P1: S6 fast tier | NOT DONE | Needs sign-in | no | Blocked on creds |
| P1: S7 advanced gating | NOT DONE | Needs sign-in | no | Blocked on creds |
| P1: S8 fallback | NOT DONE | Needs sign-in and forced failure | no | Blocked on creds |
| P1: S19 Deep cap | NOT DONE | Needs sign-in | no | Blocked on creds |
| P1: guest cap 31st message rejected | NOT DONE | Not run | no | Run as guest |
| P1: global cap circuit breaker | NOT DONE | Needs Supabase counter edit (owner cloud action) | yes | Owner approve or skip |
| P1: unauthenticated route returns 401/403 | NOT DONE | Not curled this round | no | curl run |
| P1: forged user ID ignored | NOT DONE | Needs session | no | Blocked on creds |
| P1: cross-account read blocked | NOT DONE | Needs two accounts | yes | Owner to provide accounts |
| P1: rate limit returns 429 | NOT DONE | Not run | no | Script run |
| P1: CORS refuses unknown origin | NOT DONE | Not curled this round | no | curl run |
| P1: oversized attachment rejected | NOT DONE | Not run | no | Run |
| P1: log audit (no message text or emails) | NOT DONE | Not audited | no | Audit |
| P1: secrets not in client bundle | NOT DONE | Not searched this round | no | Bundle grep |
| P2: thread window (last 10) | NOT DONE | Not run | no | Run |
| P2: thread isolation | NOT DONE | Not run | no | Run |
| P2: S21 saved fact used | NOT DONE | Needs sign-in | no | Blocked on creds |
| P2: delete one memory | NOT DONE | Not run | no | Run |
| P2: clear all memory | NOT DONE | Not run | no | Run |
| P2: guest memory local only | NOT DONE | Not run | no | Run as guest |
| P2: fake password not stored as fact | NOT DONE | Not run | no | Run |
| P2: non-blocking writes | NOT DONE | Not run | no | Run |
| P3: S4 daily cap | NOT DONE | Needs Free signed-in user | yes | Creds |
| P3: heartbeat every ~30s | NOT DONE | Not run | no | Run |
| P3: S5 client tamper | NOT DONE | Not run | no | Run |
| P3: counter reset | NOT DONE | Needs Supabase edit (owner cloud action) | yes | Owner approve or skip |
| P3: guest voice gets 403 | NOT DONE | Conflicts with 2-min trial (D-2) | yes: D-2 | Resolve D-2 |
| P3: referral minutes enforced | NOT DONE | Step 5 unticked | yes | Confirm D-6 |
| P4: S23 cache hit | NOT DONE | Cache not built (§4.9) | no | Build |
| P4: variation cache miss | NOT DONE | Cache not built | no | Build |
| P4: mode keying | NOT DONE | Cache not built | no | Build |
| P4: no personal data cached | NOT DONE | Cache not built | no | Build |
| P4: voice excluded from cache | NOT DONE | Cache not built | no | Build |
| P4: TTL expiry | NOT DONE | Cache not built | no | Build |
| P4: auth applies to cache | NOT DONE | Cache not built | no | Build |
| P4: cache hit counts toward quota | NOT DONE | Cache not built | no | Build |
| P5: mic insert without auto-send | NOT DONE | Not run on web device | no | Run |
| P5: silence timeout | NOT DONE | Not run | no | Run |
| P5: S9 unsupported browser (Firefox) | NOT DONE | Not run | no | Run |
| P5: S10 network drop | NOT DONE | Not run | no | Run |
| P5: S11 barge-in under 1s | NOT DONE | Not run | no | Run |
| P5: TTS fallback chain | NOT DONE | Not run | no | Run |
| P5: mood tags not spoken | NOT DONE | Not run | no | Run |
| P5: Android SpeechRecognizer bridge | PARTIAL | Mic bridge exists. Denial path not retested R31 | no | Retest |
| P6: S12 empathy | NOT DONE | Needs sign-in | no | Blocked on creds |
| P6: S13 honest about being AI | NOT DONE | Needs sign-in | no | Blocked on creds |
| P6: two moods, two tones | NOT DONE | Not run | no | Run |
| P6: each mood animates | NOT DONE | Character not built | no | Build |
| P6: S17 reduced motion | NOT DONE | Not run | no | Run |
| P6: tab hidden pauses animation | NOT DONE | Not run | no | Run |
| P6: 60 fps on Tier 1 device | NOT DONE | Not run | no | Run |
| P6: S22 Mermaid renders | NOT DONE | Not built | no | Build |
| P6: Mermaid prefetch while streaming | NOT DONE | Not built | no | Build |
| P6: Mermaid failed load shows code | NOT DONE | Not built | no | Build |
| P6: diagram script does not run | NOT DONE | Not built | no | Build |
| P6: diagram theme matches palette | NOT DONE | Not built | no | Build |
| P6: 30-node diagram on low-end phone | NOT DONE | Not built | no | Build |
| P7: S14 manual upgrade | NOT DONE | Needs sign-in | no | Blocked on creds |
| P7: S20 coupon exhaustion | NOT DONE | Needs sign-in | no | Blocked on creds |
| P7: S15 self-referral zero reward | NOT DONE | Needs two accounts | yes | Owner accounts |
| P7: referral reward after activity | NOT DONE | Needs sign-in | no | Blocked on creds |
| P7: S16 account deletion | NOT DONE | Needs test account | yes | Owner to approve deleting a test user |
| P8: S3 first launch on Android | PARTIAL | Guest first launch DONE (R31). Email sign-in not run | no | Creds |
| P8: intent actions | DONE | INTENT_ACTIONS.md (R31) | no | none |
| P8: shield per app | PARTIAL | SHIELD.md (R31). Per-app block. Reel audio not measured. See Part 2 | yes: option A | Decide option A |
| P8: vault survives restart | DONE | VAULT.md (R31) | no | none |
| P8: S18 low-memory | DONE | LOW_MEMORY.md (R31): banner, shield suppressed, chat still works | no | none |
| P8: offline error screen with Retry and Open in browser | PARTIAL | OFFLINE.md (R31). Open in browser tap not confirmed | no | Retest with forced screen |
| P9: all S1–S23 pass on Chrome, Edge, Android Chrome, iPhone | NOT DONE | Not run | no | After Phases 1–8 |
| P9: privacy policy lists every field, deletion link works | PARTIAL | Legal links added (R31). Public deletion page missing | yes: owner to publish deletion page | Owner |
| P9: marketing pages load without JavaScript | NOT DONE | Not checked | no | Check |
| P9: backend tests for routing, quota, auth pass | PARTIAL | API 273 pass, 1 env-blocked (R31) | no | Route tests |
| P9: no console errors on any page | NOT DONE | Not checked | no | Browser pass |
| P10 | BLOCKED | Phase 10 is not defined in beta-testing (D-7) | yes: D-7 | Owner to define or drop |
| P11 | BLOCKED | Phase 11 is not defined in beta-testing (D-7) | yes: D-7 | Owner to define or drop |
