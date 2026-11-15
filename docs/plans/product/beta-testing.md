# Beta Feature Test Plan

**Status:** Planning
**Owner:** Pico product team
**Related:** [Beta launch](beta-launch.md) · [Testing guide](../engineering/testing-guide.md) (agent and tool tests)

This file lists how to test each beta feature, ordered by the build and test priority in [Beta launch](beta-launch.md) section 6.1. Run the phases in order. Do not start a later phase until the one before it is green.

Test inputs are written as users actually type (Roman Urdu or English). Expected results are in English.

## 0. Setup

```powershell
cd services/api
npm run dev
```

```powershell
cd apps/web
npm run dev
```

Use the local subdomains: `chat.localhost:5173` for the app, `auth.localhost:5173` for auth, `api.localhost:3001` for the backend.

**Pre-flight**

- [x] Backend health check returns JSON on `http://localhost:3001/api/tts/status`. (Root `GET /` shows "Cannot GET /" — normal, only `/api/*` routes exist.) — verified 2026-11-10: Edge provider up.
- [x] No console errors on Landing, Auth, and Chat.
- [x] Supabase project reachable; test accounts exist: one signed-in Free user, one guest, one paid-plan user (manual flag).

**How to force states**

- **Primary model failure:** set the `fast` tier provider URL or key to an invalid value in backend env, or temporarily point the primary model ID to a nonexistent model.
- **Low quota:** edit the user's usage counters directly in Supabase Table Editor to just below the cap.
- **Offline:** DevTools > Network > Offline, or airplane mode on the phone.

## 1. Phase 1: Chat, Routing, and API Security

The spine. Scenarios S1, S6, S8, S19, plus checklists 12.3 and 12.7.

### 1.1 Guest and auth flow

- [ ] **S1 — Guest start:** open Landing (apex `localhost:5173`), click "Try as guest". Expected: guest session created, Chat opens with "Hello, Guest" and the Free label.
- [ ] **S2 — Guest to account:** sign up with email and password. Expected: guest chats shown after sign-in; user is asked before chats are merged.
- [ ] **Auth redirect:** sign in at `auth.localhost:5173`. Expected: lands on `chat.localhost:5173` already signed in (session handed over through the URL hash).
- [ ] **Sign-in gating:** as a guest, try a locked feature (voice, attachments, web search). Expected: lock badge and auth gate modal.

### 1.2 Model routing

- [ ] **S6 — Fast tier:** sign in, type `Hi, kaise ho?`. Expected: reply streams; backend log shows tier `fast` with request ID.
- [ ] **S7 — Advanced tier gating:** as a Free user, upload a long document (or pick Deep mode). Expected: upgrade prompt, `advanced` not used. Repeat as paid user: `advanced` runs.
- [ ] **S8 — Fallback:** force a primary-model failure (see section 0). Expected: fallback model answers; the user sees no error; log contains request ID only.
- [ ] **S19 — Deep cap:** set the Free user's Deep counter at the daily limit. Expected: upgrade prompt appears; the request is not sent to `advanced`.
- [ ] **Guest cap:** send 30 messages as a guest. Expected: message 31 is rejected on the server (not just hidden in the UI).
- [ ] **Global cap circuit breaker:** in Supabase, set the tier's global counter at the cap. Expected: every new request in that tier takes the documented downgrade path (see section 4.2 table) until reset.

### 1.3 API security

- [ ] **Unauthenticated:** `curl` a user-data route (for example `POST /api/chat`) with no session. Expected: 401/403, generic error, no stack trace.
- [ ] **Forged user ID:** call a user-data route while signed in, but with a different `userId` in the body. Expected: the server ignores it and uses the session user.
- [ ] **Cross-account read:** signed in as user A, request a resource ID belonging to user B. Expected: 403 or empty, never the data.
- [ ] **Rate limit:** script 20 rapid requests to an auth route. Expected: 429 after the limit.
- [ ] **CORS:** `curl -H "Origin: https://evil.example" ...`. Expected: the preflight is refused; browser check confirms no `Access-Control-Allow-Origin`.
- [ ] **Oversized attachment:** try to upload a file over 10 MB. Expected: rejection before parsing.
- [ ] **Log audit:** run several chat requests, then read the backend logs. Expected: request IDs, tiers, and status codes only — no message text, tokens, or emails.
- [ ] **Secrets:** search the built client bundle and browser DevTools for `SUPABASE_SERVICE` or provider key strings. Expected: none present.

**Phase 1 done when:** every item above passes and the unchecked API security rows in beta-launch section 11 are ticked.

## 2. Phase 2: Memory (Layers 1–2)

Scenario S21, checklist 12.5.

- [ ] **Thread window:** create a thread with 15 messages, then send a new message. Expected: the backend request contains only the last 10 messages of that thread (check the request body in DevTools Network).
- [ ] **Thread isolation:** start a new chat. Expected: no context from the previous thread leaks into the reply.
- [ ] **S21 — Saved fact:** save a fact in Settings > Memory (for example "meri favourite colour green hai"), start a new chat, ask `meri favourite colour kya hai?`. Expected: the reply uses the fact.
- [ ] **Delete one memory:** delete a single item. Expected: it disappears from the next request's system prompt and from the store.
- [ ] **Clear All Memory:** expected: brain and memory items wiped; next reply shows no prior facts.
- [ ] **Guests:** repeat save/view/delete as a guest. Expected: works locally; nothing is sent to Supabase (check Network tab — no `user_brain` call, or the call returns 403 and stays local).
- [ ] **Secrets filter:** try to save a fake password `mera password hunter2 hai`. Expected: it is not stored as a fact, or is stripped.
- [ ] **Non-blocking writes:** save a memory during an active reply. Expected: the reply does not pause or restart.

## 3. Phase 3: Voice Quota (Step 5)

Scenarios S4, S5, checklist 12.2. Voice Steps 1–4 and 6 are already built; this phase tests enforcement.

- [ ] **S4 — Daily cap:** sign in as a Free user, use voice until 10 minutes. Expected: voice stops at the cap with a clear message; typing still works.
- [ ] **Heartbeat tracking:** watch the Network tab during a voice session. Expected: a heartbeat every ~30 seconds; `voice_seconds_used_today` increments in Supabase.
- [ ] **S5 — Client tamper:** change the client timer or localStorage counter, then start voice. Expected: server rejects the session or ignores the client value; the Supabase counter is unchanged.
- [ ] **Reset:** set `last_reset_timestamp` to yesterday in Supabase. Expected: the counter resets on the next request.
- [ ] **Guest voice:** try voice as a guest. Expected: server returns 403; typed fallback offered.
- [ ] **Referral minutes:** after a valid referral reward, expected: the bonus minutes apply to the quota (enforcement, not just the record).

## 4. Phase 4: Response Cache

Scenario S23, checklist 13. Requires section 4.9 to be built first.

- [ ] **S23 — Cache hit:** sign in, ask `What is photosynthesis?`, wait for the reply, then ask the identical question in a new single-turn request. Expected: no provider call (check backend logs or provider dashboard), reply returned from cache, log shows a hit with request ID only.
- [ ] **Cache miss on variation:** ask `What is photosynthesis?` then `What is photosynthesis for class 8?`. Expected: two provider calls — the key includes normalized text, not a substring match.
- [ ] **Mode/agent keying:** ask the same question on Quick then Deep. Expected: two provider calls — mode is part of the key.
- [ ] **No personal data:** ask a question with memory active (saved fact present), and a question with an attachment. Expected: neither response is cached; the second call still hits the provider.
- [ ] **Voice excluded:** ask the same question by voice. Expected: no caching on voice requests.
- [ ] **TTL expiry:** set a cache entry's timestamp older than 24 hours directly in the store. Expected: the next identical request calls the provider.
- [ ] **Auth still applies:** sign out, try the same question as a guest. Expected: normal auth/rate-limit rules run; a signed-in user's cached answer is not served to a different account.
- [ ] **Quota counts:** a cache hit still increments the daily quota counter.

## 5. Phase 5: Voice Loop and Fallback Chain

Scenarios S9, S10, S11, checklist 12.2.

- [ ] **Mic insert:** press the mic, speak, expected: text inserts into the composer without auto-send.
- [ ] **Silence timeout:** speak, then stay quiet. Expected: listening stops after the timeout with a clear message.
- [ ] **S9 — Unsupported browser:** test on Firefox. Expected: mic button hidden; type-and-hear works.
- [ ] **S10 — Network drop:** start a voice reply, toggle offline mid-playback. Expected: playback stops, retry message shown, no stuck recognition session (check the voice state returns to idle).
- [ ] **S11 — Barge-in:** speak "ruk" / "stop" during a reply. Expected: playback stops within 1 second.
- [ ] **TTS fallback chain:** disable Edge TTS via the flag/env. Expected: the chain moves to the laptop TTS service, then `speechSynthesis` — voice never goes fully silent.
- [ ] **Mood tags:** a reply containing `[mood: happy]` never shows the tag on screen or speaks it aloud.
- [ ] **Android bridge:** inside the app, press the mic. Expected: Android `SpeechRecognizer` produces text; permission denial shows the typed fallback.

## 6. Phase 6: Persona, Character, and Diagrams

Scenarios S12, S13, S17, S22, checklist 12.4 and 13.

### 6.1 Persona

- [ ] **S12 — Empathy:** paste `meri job chali gayi, bahut pareshan hun`. Expected: empathetic reply; mood changes to concerned; no mood tag visible.
- [ ] **S13 — Honesty:** ask `are you a real person?`. Expected: the agent says it is an AI assistant.
- [ ] **Two moods, two tones:** ask the same neutral question in a happy context and a sad context. Expected: matching tones per the persona card.

### 6.2 Character

- [ ] **Mood reactions:** each mood in the persona card produces a distinct animation.
- [ ] **S17 — Reduced motion:** enable `prefers-reduced-motion`. Expected: orb and character animations stop; content stays readable.
- [ ] **Tab hidden:** switch tabs mid-animation. Expected: animation pauses; resumes on return.
- [ ] **Performance:** on the Tier 1 Android device, idle + speaking animations hold ~60 fps (DevTools frame meter or visual check).

### 6.3 Mermaid diagrams

- [ ] **S22 — Render:** ask `ik flowchart banao: user login process`. Expected: the diagram renders after the reply completes, with zoom and pan.
- [ ] **Streaming prefetch:** watch the Network tab during the reply. Expected: the Mermaid chunk starts loading when the `mermaid` fence appears, not after the reply ends.
- [ ] **Failed load:** block the Mermaid chunk URL in DevTools and repeat. Expected: the diagram source shows as a code block.
- [ ] **Injection:** ask the model to produce a diagram containing `<script>` or `click` handlers. Expected: nothing executes; `securityLevel: 'strict'` holds.
- [ ] **Theme:** diagram colors match the Pico palette in both light and dark modes.
- [ ] **Low-end phone:** render a 30-node diagram on the Tier 1 Android device. Expected: usable zoom/pan, no freeze.

## 7. Phase 7: Accounts, Billing, and Referral

Scenarios S14, S15, S20, checklist 12.3 and 12.5.

- [ ] **S14 — Manual upgrade:** submit a fake payment proof for a test account. Expected: plan stays Free until the server writes the subscription; then the plan label and Deep mode update.
- [ ] **S20 — Coupon exhaustion:** redeem the same early-buyer code twice, and redeem after all 26 are used. Expected: rejection with a clear message; no discount applied.
- [ ] **S15 — Self-referral:** sign up with your own `?ref=` code; create a second account using the first account's code. Expected: zero reward; both events recorded.
- [ ] **Referral reward timing:** reward only fires after real activity (email verified or first voice session), not on signup.
- [ ] **S16 — Account deletion:** delete the account on web and inside the Android app. Expected: user, sessions, and linked data removed; logged out; login fails afterwards.

## 8. Phase 8: Android Beta

Scenarios S3, S16, S18, checklists 12.8 and 12.9.

- [ ] **S3 — First launch:** fresh install. Expected: Auth screen first; guest continuation and email sign-in work.
- [ ] **Intent actions:** from chat or Settings, trigger call, open app, share-to-WhatsApp, alarm/timer, open URL. Expected: each works per checklist 12.9, with confirm dialogs where required.
- [ ] **Shield:** enable a preset, grant usage access and overlay, open Instagram or YouTube. Expected: blocked within ~1 second; "Back to Pico" returns; Pico itself is never blocked.
- [ ] **Vault:** save a value, restart the app. Expected: value survives; ref resolves on-device; no secret in logcat, network, or screenshots.
- [ ] **S18 — Low-memory device:** run on a low-RAM device. Expected: heavy features disabled with a message; chat and voice still work.
- [ ] **Offline:** airplane mode, open the app. Expected: error screen with Retry and Open in browser.

## 9. Launch Readiness Sweep

- [ ] All scenarios S1–S23 pass on Chrome and Edge desktop, Chrome on Android, and one iPhone (voice fallback check).
- [ ] Privacy policy lists every stored field; account deletion link works from the store listing URL.
- [ ] Marketing pages load without JavaScript.
- [ ] Backend tests for routing, quota, and auth pass.
- [ ] No console errors on any page.
