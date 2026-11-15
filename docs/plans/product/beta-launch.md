# Beta Launch Plan

**Status:** Planning
**Owner:** Pico product team
**Platforms:** Web (browser) and Mobile (Android, Kotlin WebView)
**Related:** [Feature catalog](feature-catalog.md) · [Roadmap](roadmap.md) · [Beta test plan](beta-testing.md) · [Voice mode](../modules/voice-mode.md) · [Agent persona](../modules/agent-persona.md) · [Pico character](../modules/pico-character.md) · [Memory system](../modules/memory-system.md) · [Authentication](../engineering/authentication.md) · [Branching strategy](../engineering/branching-strategy.md)

## 1. Summary

The beta launches Pico on the web and on Android. It includes the full voice mode, automatic model routing on the backend, a persona system that gives the agent emotions and reactions, and an anime-inspired chibi character for animation.

This document lists only what ships in the beta. Anything not listed here is out of scope.

## 2. Scope

| Area | Notes |
|---|---|
| Voice mode (Steps 1–6) | Full voice pipeline. See section 4.1 |
| Model auto-routing and user-facing modes (Quick, Smart, Deep) | Model names are never shown to users. See section 4.2 |
| Persona system with emotions and reactions | See [Agent persona](../modules/agent-persona.md) |
| Anime-style chibi character and animation | See section 4.4 |
| Authentication (guest, email and password sign-up and sign-in) | Standard email and password sign-up and sign-in, plus guest continuation. See [Authentication](../engineering/authentication.md) |
| Plan limits and early-buyer offer | Manual plan flag, no payment provider at beta. When a user picks a paid plan, a popup shows the NayaPay QR code and payment instructions. The buyer sends payment and contacts Pico with proof; the plan is set manually after confirmation. 26 early-buyer coupons apply to the Pro Monthly plan only, giving 50% off the first 3 months. Each code redeems once, first come, first served. Expires Dec 31, 2026 (23:59 UTC) |
| Referral system (optional code) | Code is optional at signup. Reward is given only after a real activity. Anti-abuse rules apply. See section 4.5 |
| Personalized memory (Layers 1–2: thread window, Global Brain, Memory panel) | Guests get local-only memory. See [Memory system](../modules/memory-system.md) |
| Android native agent layer (intent actions, whole-app shield, onboarding consent, FCM push) | Limited on purpose so Play approval stays easy: place call, open app, share-to-WhatsApp prefilled, alarms/timers, open URLs, and a whole-app shield via usage access + overlay. No AccessibilityService in the build, so near-zero review risk while proving mobile control. See [Android app](../engineering/android-app.md) |
| API security baseline (auth on every route, session cookies, CORS allowlist, rate limits, input limits, secrets, safe errors and logs) | Required for every beta route. See section 4.7 and [API security](../security/api-security.md) |
| Pico Vault v1 (tokenized personal data, strictly local) | On-device encrypted store; values stay as opaque IDs the model never sees. Not required for intent actions or the shield — those run on plain intents. See [Pico vault](../modules/pico-vault.md) |
| Chat diagrams (Mermaid, with pan and zoom) | Client-side rendering, loaded on demand. See section 4.8 |
| Response cache (exact match, no personal data) | Backend cache for repeated single-turn questions. See section 4.9 |

## 3. Pages by Platform

The web and mobile apps have different page sets. Both are built from the same React code where possible.

### 3.1 Web (3 pages)

| Page | Domain | Purpose | Key elements |
|---|---|---|---|
| **Landing** | `askpico.app` | Explain the product and drive sign-up | Hero, feature highlights, voice and persona preview, plan summary, sign-in and "Try as guest" buttons |
| **Auth** | `auth.askpico.app` | Sign in or create an account | Email and password sign-up and sign-in form, guest continuation, legal links (privacy policy, terms) |
| **Chat** | `chat.askpico.app` | Main product screen | Sidebar (new chat, history, agents), greeting and orb, composer with mic, account card |

### 3.2 Mobile (3 pages)

The Android app is a Kotlin WebView shell. Full build plan: [Android app](../engineering/android-app.md).

| Page | Purpose | Key elements |
|---|---|---|
| **Auth** | Sign in or continue as guest | Email and password sign-up and sign-in form, guest continuation, legal links |
| **Chat** | Main product screen | Same as web Chat, with a mobile layout and voice button |
| **Profile** | Account and settings | Name and avatar, plan, voice minutes used, referral code and reward summary, log out, delete account |

### 3.3 Page rules

- Web Landing is public. Auth and Chat are reachable by URL. The app redirects signed-out users to Auth, except guests who continue from Auth.
- Mobile has no Landing page. The first screen is Auth.
- Profile on web is the account card menu inside Chat (Account, Referral, Plan, Log out), not a separate page. This matches [Authentication](../engineering/authentication.md) section 7.
- Account deletion is available on both platforms. Google Play requires it.

### 3.4 Marketing site (`askpico.app`)

A separate static site (HTML, CSS, and JS). It has no app logic and no login. Its CTAs link to `auth.askpico.app` and `chat.askpico.app`.

| Page | File | Purpose | Key elements |
|---|---|---|---|
| **Home** | `index.html` | First impression and sign-up | Hero, "Try as guest" and "Sign in" CTAs, feature summary, plan summary |
| **Features** | `features.html` | Explain each beta feature | Voice mode, agents, artifacts, persona and character |
| **Pricing** | `pricing.html` | Show the plans | Free, Weekly Pass, Monthly Pro, Ultra (prices from the [feature catalogue](feature-catalog.md), section 3) |
| **About** | `about.html` | Mission and team | Pico's purpose for Urdu, Hindi, and Roman Urdu speakers |
| **Contact** | `contact.html` | Support and business contact | Email address and a short form or mailto link |
| **Referral** | `referral.html` | Explain the referral program | How the link works (`/?ref=<code>`), reward summary from [Voice mode](../modules/voice-mode.md) step 5, anti-abuse rules in plain words |
| **Privacy Policy** | `privacy.html` | Legal (required) | Every stored field: email, name, plan, referral, usage counts (see [Authentication](../engineering/authentication.md) section 11) |
| **Terms of Service** | `terms.html` | Legal (required) | Use rules, plan terms, account deletion |

**Rules**

- Pages are static, with no build step required for the MVP. Shared header and footer are repeated in each file for simple SEO.
- No API keys, tokens, or user data on the marketing site.
- Pricing and reward numbers are copied from the plan docs. Update them in one place when they change.
- Every page must work without JavaScript, except the mobile menu toggle.

## 4. Core Beta Features

### 4.1 Voice mode (full)

Implements the six steps in [Voice mode](../modules/voice-mode.md):

1. Mic button (speech to text, insert only, no auto-send).
2. Continuous listening with silence timeout and clear errors.
3. Guardrail and persona layer (sanity fix, mood tags stripped from display).
4. Speech output (Edge TTS primary behind a flag, laptop TTS service as backup, `speechSynthesis` as the last resort, then audio filters).
5. Voice quota and referral enforced on the server.
6. Voice-to-voice loop with sentence-level streaming and barge-in.

**Voice pipeline**

- **Speech-to-text:** the browser `SpeechRecognition` API transcribes on the device. Only the text goes to the backend; audio is never uploaded.
- **TTS provider abstraction:** a `ttsProvider` config on the backend selects the voice engine so a broken provider is swapped by configuration, not a code change.
- **TTS fallback chain:** Edge TTS proxy (flagged) → laptop TTS service (`edge-tts` library or Kokoro-82M behind a Cloudflare Tunnel; English only for Kokoro) → client-side `speechSynthesis` in the user's own browser. The client always keeps `speechSynthesis` as the last resort so voice never goes fully silent.
- **Android app:** the WebView lacks `SpeechRecognition`, so voice input uses a native bridge (Android `SpeechRecognizer` wired into the WebView) or the typed fallback.
- **Quota tracking:** `voice_seconds_used_today` and `last_reset_timestamp` on the user profile in Supabase. The client sends a heartbeat every 30 seconds while voice mode is on; the server increments usage and ends the session at the daily cap (10 minutes on free). Audio never passes through Supabase, so free-tier egress is untouched.

**Done when:** a spoken question gets a spoken answer on Chrome Android and desktop Chrome or Edge, speaking during an answer stops playback, the quota blocks a free user at the limit, the TTS fallback chain works when a provider is disabled by flag, and the text fallback works on Firefox and inside the Android app.

### 4.2 Model auto-routing (backend)

The user chooses an agent or asks in plain language. The backend chooses the model. The client does not pick a model, unless a paid plan allows it.

**Routing inputs**

- Request type: plain text, attachment, tool request, or voice turn.
- Complexity estimate: message length, number of attachments, and task keywords.
- Latency priority: voice turns get a lower latency target.
- Plan tier: caps the highest model tier a user can reach.

**Routing output**

- A tier: `fast`, `standard`, or `advanced`. Each tier maps to a configurable provider and model.
- A fallback chain. If the primary call times out, returns HTTP 429, or returns 5xx, the backend tries the next model in the chain.

**Rules**

- Tier mapping lives in configuration, not in client code.
- The provider switch (`LLM_PROVIDER`: Gemini or OpenRouter) continues to work. Auto-routing sits above it.
- Routing decisions are logged with the request ID and tier only. Message text is not logged.
- Rate limits apply per user and per plan, enforced on the server.
- The API response never contains the provider or model name. The client shows only the mode (Quick, Smart, or Deep) and cannot control the model choice.

**User-facing modes**

- Users see three modes: **Quick** (`fast`), **Smart** (`standard`), and **Deep** (`advanced`). An Auto option (default) lets the backend choose.
- Provider and model names (for example GPT, Claude, or Gemini models) are never shown in the UI or in the API response.
- Deep is limited by plan. Free users get a set number of Deep messages per day, and the upgrade prompt appears after that.

**Tier mapping (configuration only)**

| Mode | Tier | Model ID and provider | Approx pricing per 1M tokens | Used for |
|---|---|---|---|---|
| Quick | `fast` | Llama 3.1 8B Instant, Groq | Input $0.05, output $0.08 (free tier $0) | Fast routing, simple Q&A, voice turns |
| Smart | `standard` | `deepseek/deepseek-v4.1-flash` or Qwen 2.5 32B, OpenRouter (fallback Groq) | Input $0.15, output $0.60 | Multi-turn Q&A, Studio, data processing |
| Deep (Fast) | `advanced` | `anthropic/claude-haiku-5.5`, OpenRouter | Input $0.10, output $0.50 | Live artifact and UI preview, HTML/React rendering |
| Deep (Pro) | `advanced` | `deepseek/deepseek-v4-pro`, OpenRouter | Input $0.66 to $1.32, output $1.98 to $3.96 | Multi-file artifacts, complex logic |

**Budget and daily caps ($50/month, about $1.66/day, for 300 testers)**

| Mode | Traffic share | Budget per month | User daily quota | Global app cap | Cap-hit behavior |
|---|---|---|---|---|---|
| Quick | 60% | $2 | Unlimited | Unlimited | Groq free tier, then OpenRouter free model |
| Smart | 25% | $8 | 30 prompts | 3,000 requests/day | Downgrade to Quick |
| Deep (Fast) | 10% | $15 | 5 requests | 300 requests/day | Downgrade to Smart |
| Deep (Pro) | 5% | $25 | 2 requests | 50 requests/day | Downgrade to Deep (Fast), then Smart |

Rules for the mapping:

- Prices are estimates. Re-check the provider pricing pages at launch and adjust the caps if the real prices differ.
- The per-user quota and global app cap are both enforced on the server. The global cap is a circuit breaker: when it is hit, every further request in that tier takes the downgrade path until the next day.
- Deep (Pro) is the costliest path. It stays behind the strict cap above and is reserved for paid plans and complex tasks.
- Deep (Fast) is for fast live rendering, so it needs a lower latency target than Deep (Pro).
- Free OpenRouter models have their own data terms. Do not send user messages to them unless the data settings in [Data protection](../security/data-protection.md) section 6 are confirmed.

**Done when:** a simple query uses the `fast` tier, a long document task uses `advanced`, a forced primary failure falls back to the next model, and a free user cannot reach `advanced` through a client change.

### 4.3 Persona system with emotions and reactions

Defined in [Agent persona](../modules/agent-persona.md). Summary:

- Each agent has a persona with a defined role and tone.
- The persona has an emotional state (for example neutral, happy, excited, sad, concerned, thinking) that changes with the conversation.
- Reactions are short, human-style responses: acknowledging good news, showing empathy when the user is stressed, admitting uncertainty, and using light humor where it fits.
- Humanized touches: natural pacing (typing indicator length follows reply length), using the user's name when known, and never pretending to be a human when a user sincerely asks.
- Emotion tags are produced by the model as `[mood: ...]` and are removed by the guardrail layer before display.

**Done when:** the same question in two different moods gets two appropriate tones, mood tags never appear in the UI, and reactions match the persona card for each agent.

### 4.4 Anime-style chibi character and animation

Defined in [Agent persona](../modules/agent-persona.md) (visual style and animation) and [Pico character](../modules/pico-character.md) (layers and state).

- **Style:** Chibi: a large head, a small body, large expressive eyes, minimal line work, and a soft pastel palette. The character is original. Do not copy existing anime characters.
- **Animation:** Idle breathing, random blinking every 3–5 seconds, smooth mood transitions (200–300 ms), a speaking mouth synced to the voice output, and short reaction animations (bounce for happy, a sweat drop for stress, sparkles for excitement).
- **Implementation:** SVG layers and CSS keyframes. No animation library. Respect `prefers-reduced-motion`. Pause animation when the tab is hidden.

**Done when:** the character reacts to every mood in the persona card, runs at 60 fps on a Tier 1 Android device, and stops animating when reduced motion is on.

### 4.5 Referral and voice quota

- **Referral code:** optional at signup. A link with `?ref=<code>` fills the code in automatically. Users without a code sign up normally.
- **Reward:** given only after the referred user completes a real activity (for example, the first completed voice session or email verification). No reward on signup alone.
- **Voice quota:** a daily voice limit per plan, enforced on the server. Referral rewards add minutes to this quota.
- **Anti-abuse:** the same account, repeat accounts, and self-referrals give zero reward. All reward events are recorded in the database.

**Done when:** a valid code gives a reward only after activity, and a self-referral gives zero reward.

### 4.6 Personalized memory

Defined in [Memory system](../modules/memory-system.md). Layers 1–2 are the beta scope:

**Beta scope**

| Step | Layer | Work | Why it is required |
|---|---|---|---|
| M-A | Short-term window | Local message tables; each turn sends only the last 10 messages of the active thread | The token-cap protector. Without it, long threads blow the $50/month budget |
| M-B | Global Brain + Memory panel | `user_brain` table, local cache, Settings memory controls (enable, view, delete, clear) | Personalization and user control are visible beta features; clearing memory is a privacy requirement |

**Behavior in beta**

- **Short-term window:** only the last 10 messages of the active thread are sent per turn. Threads stay isolated, keeping input near ~1–2k tokens.
- **Global Brain:** a small curated profile (user, rules, active projects) under 300 tokens, cached locally and always injected into the system prompt.
- **Memory panel:** the user can enable memory, view saved facts, delete items, and clear all memory. Saved facts enter the brain only through an explicit user command or a suggestion the user approves.
- **Guests:** Layers 1–2 work locally only (IndexedDB/Room).
- **Writes are non-blocking:** no memory write delays the reply.

**Done when:** a new thread sends only the last 10 messages, a fact saved in the Memory panel appears in the next system prompt, deleting a memory removes it from the store and cache, and Clear Memory wipes the brain and memory items for the user.

### 4.7 API security (beta scope)

Defined in [API security](../security/api-security.md). Every item below ships in beta. No route goes live without them.

- **Authentication and authorisation:** every route that reads or writes user data requires a valid session. The user ID comes only from the verified session, never from the request body or query string. Plan, quota, and tier are read from the database on each request. Account-scoped queries always filter by the authenticated user ID.
- **Session cookies:** `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`. Session lifetime and renewal are enforced on the server.
- **CORS:** allow only the known web origins (`chat.`, `auth.`, and the marketing site). No `*`. `Access-Control-Allow-Credentials` only where a cross-origin cookie request needs it.
- **Rate limiting:** every auth route is rate limited. Image generation keeps its per-route limit in `server.js`. Limits are per user when known, and per IP otherwise. Routing limits are per user and per plan (section 4.2).
- **Input handling:** validate size and type of every request body. Attachments are capped at 10 MB. PDF and DOCX parsing runs on the server with size limits, and extracted text is treated as data. User content is escaped or sanitised before rendering. All database access uses parameterised queries.
- **Secrets:** provider keys and the Supabase service role key live only in backend environment files. Env files are git-ignored, and `.env.example` lists names with empty values. The service role key is never used in the browser.
- **Errors and logging:** clients get generic error messages. Upstream AI provider response bodies are never returned. Logs contain request IDs, routing tiers, and status codes only. No message text, tokens, or emails.
- **Release checklist:** each release confirms that every new route has auth and a rate limit, no new secret reaches the client, CORS is unchanged or reviewed, logs hold no personal data, and backend auth and quota tests pass.

**Done when:** an unauthenticated request to a user-data route is rejected, a forged user ID in the body is ignored, an auth route returns 429 after the limit, a CORS request from an unknown origin is refused, an oversized attachment is rejected, and a log sample contains no message text or email.

### 4.8 Chat diagrams (Mermaid)

- **Rendering:** Mermaid diagrams in assistant replies (flowchart, mindmap, sequence, state, Gantt) render in the browser and Android WebView, with pan and zoom from `panzoom`.
- **Loading:** the Mermaid chunk is lazy-loaded. Start loading when a `mermaid` code fence appears during streaming, so it is ready when the reply finishes. Show a fixed-height placeholder while loading.
- **Rendering timing:** render only after the reply completes, never on partial syntax.
- **Security:** use Mermaid `securityLevel: 'strict'`. Diagram text is treated as data and never runs script or HTML.
- **Theme:** use the Pico palette through Mermaid theme variables.
- **Fallback:** if the chunk or render fails, show the diagram source as a plain code block.

**Done when:** a flowchart in a reply renders with zoom and pan, the chunk starts loading during streaming, a failed load shows the code block, and a diagram containing script tags does not execute.

### 4.9 Response cache (exact match)

- **Key:** hash of the user ID, the normalized message text, the user-facing mode (Quick, Smart, or Deep), and the agent ID.
- **Eligible requests:** single-turn text only. Requests with attachments, Global Brain or memory injection, or voice are never cached.
- **Storage and TTL:** stored on the backend with a 24-hour TTL. Expired entries are never returned.
- **Quota:** cache hits still pass auth and rate limits, and count toward the daily quota.
- **Logging:** hit or miss with request ID only. No message text.

**Done when:** the same single-turn question asked twice within 24 hours makes one provider call and logs a hit, a request with memory or an attachment is never cached, and an expired entry is not returned.

## 5. Launch Scenarios

| # | Scenario | Expected result | Owner |
|---|---|---|---|
| S1 | New visitor on the web opens Landing and clicks "Try as guest" | Guest session created. Chat opens with "Hello, Guest" and the Free plan label | Auth |
| S2 | Guest signs up or signs in with email and password | Guest chats are shown after sign-in. The user is asked before any chats are merged | Auth |
| S3 | Mobile user opens the app for the first time | Auth screen first. Guest continuation or email sign-up and sign-in works | Mobile |
| S4 | Free user uses voice until the daily limit | Voice stops at the limit with a clear message. The limit is enforced by the server | Voice |
| S5 | Free user changes the client timer or local storage | Quota does not change. Server rejects the voice session | Voice and Auth |
| S6 | User asks a simple question by text | Routed to the `fast` tier. Reply appears in the chat | Backend |
| S7 | User uploads a large document and asks for analysis | Routed to `advanced` only if the plan allows it. Otherwise the user sees an upgrade prompt | Backend |
| S8 | Primary model times out | Fallback model answers. The user sees no error. The log contains a request ID only | Backend |
| S9 | Speech recognition is unsupported (Firefox, iOS Safari) | Mic button is hidden. Type-and-hear fallback works | Voice |
| S10 | Network drops during a voice reply | Playback stops. A retry message appears. No recognition session stays active | Voice |
| S11 | User says "stop" or speaks during a reply | Playback stops within one second | Voice |
| S12 | Persona reacts to bad news from the user | Empathetic reply with the agent's mood changing to concerned. Mood tag is hidden | Persona |
| S13 | User asks "are you a real person?" sincerely | The agent says it is an AI assistant. It does not claim to be human | Persona |
| S14 | Early buyer is upgraded manually after payment is confirmed | Plan label and Deep mode update only after the server writes the subscription | Auth and billing |
| S15 | Referral link is used by the same account, or by a repeat account | Zero reward. Recorded in the database | Auth |
| S16 | User deletes the account from Profile | User, sessions, and linked data are removed. User is logged out | Auth |
| S17 | Reduced motion is enabled | Orb and character animations stop. Content stays readable | UI |
| S18 | Low-memory Android device | Heavy features are disabled with a message. Chat and voice keep working | Mobile |
| S19 | User picks Deep on the free plan after the daily limit | Upgrade prompt is shown. Deep is not used | Backend |
| S20 | Early-buyer coupon is used after the limit is reached | Coupon is rejected with a clear message. No discount is applied | Auth and billing |
| S21 | User saves a fact in the Memory panel and starts a new chat | The fact is injected into the system prompt. Deleting or clearing memory removes it everywhere | Memory |
| S22 | Reply includes a Mermaid diagram | Diagram renders after the reply completes, with zoom and pan. If rendering fails, the source shows as a code block | Frontend |
| S23 | Same single-turn question asked twice within 24 hours | Second reply comes from cache with no provider call. Log shows a hit with request ID only | Backend |

## 6. Milestones

| Milestone | Contents | Exit condition |
|---|---|---|
| M1: Foundations | Auth Phases 1–2 (guest session, home UI), auto-routing skeleton | S1 and S6 pass |
| M2: Voice | Voice Steps 1–4 | S9, S10, and S11 pass on Chrome, Edge, and Android Chrome |
| M3: Accounts and limits | Auth Phases 3–4 (email and password sign-up and sign-in, subscriptions), voice Step 5, memory M-A–M-B (thread window, Global Brain, Memory panel) | S2, S4, S5, S14, S21 pass |
| M4: Persona and character | Persona system, chibi character, reactions | S12, S13, S17 pass |
| M5: Voice loop and routing | Voice Step 6, full routing with fallback | S7, S8 pass |
| M6: Mobile beta | Kotlin WebView shell, Profile page, Google Play internal testing | S3, S16, S18 pass |
| M7: Launch readiness | Privacy policy, terms, account deletion, Google Play checklist (section 8), landing page | All scenarios pass. Store review checklist complete |

M1 to M5 are web-first. M6 can begin once the web Chat page is stable.

### 6.1 Build and test priority

Finish and test each item fully before moving to the next. The chat pipeline is the spine of the product — every feature depends on it.

1. **Chat, routing, and API security:** the spine. Scenarios S1, S6, S8, S19 and checklists 12.3 and 12.7 must pass. The unchecked API security items in section 11 (verified session on every user-data route, account-scoped queries, parameterised queries, session cookies) are blockers — fix them before any polish work.
2. **Memory (Layers 1–2):** injected into every turn, so a memory bug corrupts every reply. Scenarios S21 and checklist 12.5.
3. **Voice quota (Step 5):** the revenue and anti-abuse control. Scenarios S4 and S5, checklist 12.2.
4. **Response cache (section 4.9):** protects the monthly budget. Scenario S23 and checklist 13.
5. **Voice loop and fallback chain:** barge-in and provider fallbacks. Scenarios S10 and S11.
6. **Persona, character, and Mermaid diagrams:** polish, not the backbone. Scenarios S12, S13, S17, S22. If the launch is tight, these can ship last or be cut.

## 7. Exit Criteria

- All scenarios in section 5 pass on the target devices (Chrome and Edge desktop, Chrome on Android, one iPhone for the web fallback check).
- No raw personal data appears in outbound requests from the chat, voice, or auth flows.
- No console errors on the Landing, Auth, and Chat pages.
- Privacy policy lists every stored field: email, name, plan, referral, and usage counts.
- Account deletion works end to end.
- Backend tests (routing, quota, and auth) pass. Frontend tests (voice states, persona mood handling, orb states) pass. See [Testing guide](../engineering/testing-guide.md).

## 8. Release Process

- **Branches:** beta work is merged into `release` after review. Only `release` is deployed to beta. See [Branching strategy](../engineering/branching-strategy.md).
- **Deployments:** the web side has two deployments, both built from this repository.
  - **Marketing site** at `askpico.app`: home, features, pricing, and other marketing content. Static HTML/CSS/JS (or an SSG such as Astro), deployed separately so marketing changes carry no risk to the app.
  - **App** at `chat.askpico.app` and `auth.askpico.app`: one deployment of `apps/web`; the page is chosen by `window.location.hostname` (chat → app, auth → login/signup). A session cookie with `Domain=.askpico.app` is shared across the subdomains.
  - **Backend** at `api.askpico.app` (or the backend host's domain): hosted separately; CORS allows only the three web origins.
- **Android:** Google Play internal testing track for beta testers, then closed testing before public release. A new personal developer account must run a closed test with at least 12 opted-in testers for 14 days before production is unlocked.
- **Rollback:** Redeploy the previous `release` commit. Revert the backend environment flag first when the cause is a feature flag, such as Edge TTS.

### 8.1 Local development subdomains

Local development mirrors the production subdomain layout so hostname-based routing is exercised before launch. `*.localhost` resolves to `127.0.0.1` automatically in modern browsers; no hosts-file edits are needed.

| Local URL | Serves | Status |
|---|---|---|
| `chat.localhost:5173` | Chat app (`apps/web`) | Working — page is chosen by hostname check |
| `auth.localhost:5173` | Auth page (same `apps/web` dev server) | Working |
| `chama.localhost:5174` | Admin (`apps/admin`) | Needs `host: true` in the admin `vite.config.ts` so Vite accepts the subdomain host |
| `api.localhost:3001` | Backend (`services/api`) | Works automatically; CORS must allow all `*.localhost` dev origins |
| `localhost:5173` (apex) | Marketing site | `marketingOnApex` middleware in the web `vite.config.ts` serves `apps/marketing` files on the apex host — mirrors `askpico.app` in production |

**Rules**

- **CORS:** the backend allowlist includes the three web origins (`chat.`, `auth.`, `chama.` on `localhost`) in development, matching the production rule of allowing only the app origins.
- **Session sharing:** Supabase stores its session in `localStorage`, which is per-origin, so `auth.localhost` and `chat.localhost` do not share a session. On the auth → chat redirect the session tokens are passed in the URL hash; `detectSessionInUrl` (already enabled in the Supabase client) picks them up and persists the session on the chat origin. The same pattern applies to `auth.askpico.app` → `chat.askpico.app` if the shared `.askpico.app` session cookie is not used.
- **Marketing:** served on the apex host (`localhost:5173`) by the `marketingOnApex` middleware in `apps/web/vite.config.ts`, which reads files from `apps/marketing`. It carries no app logic; app paths on the apex host (for example `/auth` and Vite internals) still fall through to the normal dev server. The standalone `apps/marketing/server.mjs` remains available on port 5175 if needed.

**Google Play requirements (mandatory for launch)**

Full policy checklist, Play Billing rules, and open decisions: [Play Store compliance](play-store-compliance.md).

- **Build:** signed Android App Bundle (AAB, not APK) uploaded with Play App Signing, targeting the latest required API level.
- **Privacy policy:** public URL (`askpico.app/privacy.html`) linked in the store listing and inside the app.
- **Account deletion:** an in-app delete flow plus a public web link for deletion requests (both are required for apps that create accounts).
- **Data safety form:** declare collected data: email, name, user content (messages), and usage counts. Voice audio stays on the device in the current pipeline, which keeps this form small.
- **Permissions:** `INTERNET` and `RECORD_AUDIO`. Mic access needs a prominent in-app disclosure and consent before the first recording, per the user data policy.
- **Content rating:** complete the IARC questionnaire. The app is for a general audience; do not mark it as designed for children.
- **Declarations:** no ads, target audience age, and the app-category declarations in Play Console.
- **Store listing assets:** app icon (512x512), feature graphic (1024x500), at least 2 screenshots, short description (80 chars), full description, category, and a support email.
- **Native feature:** a WebView-only app can be rejected. The native voice bridge (Android `SpeechRecognizer`) doubles as the required native functionality.

## 9. Risks

- **Browser speech support:** Firefox lacks full speech APIs, and the Android WebView does not support `SpeechRecognition` even when Chrome is installed. Voice input in the app needs a native bridge (Android `SpeechRecognizer` wired into the WebView) or the typed fallback. Keep the text fallback as a first-class flow.
- **Edge TTS terms:** Unofficial, can break. Keep the fallback chain working: laptop TTS service, then client-side `speechSynthesis`.
- **Routing cost:** A wrong tier assignment increases cost. Cap `advanced` for free users, and monitor the cost per tier weekly.
- **Store review:** Google Play rejects submissions over the mandatory items in the section 8 checklist. Common failure points for this app: missing web deletion link, undeclared mic permission, and a WebView with no native feature.
- **Payments:** No payment provider at beta. The plan popup shows the NayaPay QR code; the buyer pays by QR and messages Pico with proof of payment. The plan is set manually after payment is confirmed. Manual confirmation takes time, so the popup must set expectations on wait time. Fake payment proofs are a risk, so confirmation needs the actual transaction reference.

## 10. Open Decisions

- D1: Android paid plans must use Play Billing. Decide whether NayaPay is hidden on Android (see [Play Store compliance](play-store-compliance.md) section 10).
- D2: Weekly Pass as a consumable in-app product, or removed from beta.
- D3: Early-buyer offer format on Android (Play offer, promo code, or web only).
- D4: Whether the whole-app shield and Intent actions ship in beta, with Play permission declarations verified.
- D5: Call action uses `ACTION_DIAL` (no permission) or `ACTION_CALL` (`CALL_PHONE` runtime request).
- D6: v2 agentic and v3 WhatsApp automation plans must pass a review against the Accessibility API policy before v2 starts.
- D7: Live web search with cited answers (Vane, MIT, with SearXNG as a separate AGPL-3.0 service run unmodified). Decide after comparing the current web search quality. If adopted, the search route needs auth, rate limits, and input limits (section 4.7).

## 11. Build Status

Checked against the codebase. Items marked `[ ]` are not yet found in code.

### Voice mode
- [x] Step 1: Mic button, speech-to-text insert
- [x] Step 2: Continuous listening with silence timeout
- [x] Step 3: Mood tags stripped from speech and display
- [x] Step 4: TTS chain (Edge, laptop, speechSynthesis)
- [ ] Step 5: Server-side voice quota and referral minutes
- [x] Step 6: Voice-to-voice loop with sentence streaming and barge-in

### Routing and limits
- [x] Auto-routing across fast, standard, and advanced tiers with plan cap and global cap
- [x] Fallback chain on timeout, 429, and 5xx
- [x] Daily token cap enforcement
- [x] Guest daily message limit (30/day, server-enforced per anonymous user)

### Persona and character
- [x] Persona system with per-agent persona and mood tags
- [ ] Chibi character and animation
- [x] Reduced motion support

### Referral
- [x] Referral link shown in Settings > Account, `?ref=` capture and claim endpoint
- [x] Reward only after real activity (email verified or first voice session), with self-referral and repeat-account checks and audit log. Bonus minutes are recorded but not yet enforced, since voice quota (Step 5) is pending

### Memory
- [x] Layer 2: last 10 messages thread window
- [x] Layer 1: Global Brain sync
- [x] Memory panel: view, delete, clear

### Auth and billing
- [x] Guest continuation (anonymous session)
- [x] Email and password sign-up and sign-in (web; standalone `auth.*` page plus Settings > Account modal, sessions handed to chat via URL hash)
- [x] Sign-in gating for locked features (settings, model modes, web search, deeper research, voice, live tools, attachments, TTS, image generation) with lock badges and the auth gate modal
- [x] Voice mode and voice endpoints restricted to signed-in accounts (server 403 for guests)
- [x] Account deletion (web, Settings > Account)
- [x] Account deletion (Android, via in-app WebView Settings > Account)
- [x] Manual billing popup with NayaPay QR and early-buyer coupons (26 codes, 50% off first 3 months on Pro Monthly, expires Dec 31 2026)
- [x] Manual plan flag set after payment confirmation (no payment provider at beta)

### Web and marketing
- [x] Web Chat page: sidebar, composer with mic, account card
- [x] Marketing site pages (index, features, pricing, about, contact, referral, privacy, terms)
- [x] Marketing site light/dark theme toggle

### API security
- [ ] Every user-data route requires a verified session; user ID taken only from session
- [x] Plan, quota, and tier read from the database on each request
- [ ] Account-scoped queries filter by the authenticated user ID
- [ ] Session cookies set `HttpOnly`, `Secure`, `SameSite=Lax`, path `/`
- [x] CORS allows only known web origins (no `*`); production allows only `CORS_ORIGIN`, localhost only in development
- [x] Every user-data route is rate limited (per user ID for signed-in routes, per IP for pre-auth routes); in-memory, so a shared store is needed before multiple instances
- [x] Request body size and type validated (chat messages: roles, count, length); attachment file names and size (10 MB) validated
- [ ] PDF and DOCX parsed server-side with size limits; extracted text treated as data
- [x] User content escaped or sanitised before rendering (Markdown without raw HTML; code highlighting escaped)
- [ ] All database access uses parameterised queries
- [x] Provider keys and service role key kept in backend env only; env files git-ignored
- [x] Clients get generic errors for upstream, tool, agent, and stylesheet failures; upstream provider bodies never returned
- [x] Submission logs record field names only, not field values
- [ ] Logs contain request IDs, tiers, and status codes only across all routes (not fully audited)
- [ ] Backend tests for auth and quota pass (security helpers and quota policy: 93 tests pass; route-level auth tests not yet written)

### Diagrams and cache
- [ ] Mermaid rendering in chat with pan and zoom (section 4.8)
- [ ] Mermaid chunk loads during streaming, with placeholder and code-block fallback
- [ ] Exact-match response cache with 24-hour TTL (section 4.9)
- [ ] Cache skips memory, attachment, and voice requests

### Android
- [x] WebView shell and native voice bridge
- [x] Share and open-in-browser bridge
- [x] Intent actions (place call with confirm, open app, share-to-WhatsApp prefilled, alarms/timers, open URLs) — code complete, device testing pending
- [x] Whole-app distraction shield (usage access + overlay, Back to Pico) — code complete, device testing pending
- [x] Pico Vault v1, strictly local (encrypted store, on-device ref resolution) — code complete, device testing pending
- [x] Agent settings in web app (permissions, shield presets, private details), shown only inside the Android app
- [x] Native bridge wrapper with `PicoAction.onResult` listener (`utils/nativeAgent.ts`)
- [ ] Chat action triggers (no chat UI calls `runAgentAction` yet)
- [ ] FCM push notifications (needs Firebase project and `google-services.json`)
- [ ] Onboarding permission consent flow (deferred)
- [ ] Native Profile page (web Settings > Account covers plan, referral, logout, delete)

## 12. Test Checklist

Tick each item after it passes on the target device or browser. Scenario IDs refer to section 5.

### 12.1 Web: Landing, Auth, Chat

- [ ] S1: Guest opens Landing, clicks "Try as guest", sees "Hello, Guest" and Free label
- [ ] S2: Guest signs up or signs in, asked before chats are merged
- [ ] Email and password sign-up, sign-in, and redirect from `auth.` to `chat.`
- [ ] Sign-in gating: locked features show lock badge and auth gate modal
- [ ] Chat: send, new chat, history, sidebar, account card menu
- [ ] Attachments: 10 MB limit enforced, oversized file rejected

### 12.2 Web: Voice

- [ ] Mic button inserts text, does not auto-send
- [ ] Continuous listening stops after silence timeout with clear error
- [ ] TTS chain works when Edge TTS flag is off (laptop TTS, then `speechSynthesis`)
- [ ] S4: free user stops at 10 minutes per day
- [ ] S5: changing client timer or storage does not change quota
- [ ] S9: mic hidden on Firefox and iOS Safari, type-and-hear works
- [ ] S10: network drop during reply stops playback, shows retry
- [ ] S11: "stop" or speech during reply stops playback within 1 second
- [ ] Voice-to-voice loop with barge-in

### 12.3 Web: Routing, Limits, Billing

- [ ] S6: simple question routed to `fast`
- [ ] S7: long document routed to `advanced` only if plan allows, otherwise upgrade prompt
- [ ] S8: forced primary timeout falls back with no visible error
- [ ] S19: free user on Deep after limit sees upgrade prompt
- [ ] Guest limit of 30 messages per day enforced on server
- [ ] S14: plan label and Deep mode update only after server writes subscription
- [ ] S20: exhausted early-buyer coupon rejected with clear message
- [ ] Manual billing popup shows NayaPay QR and wait-time message

### 12.4 Web: Persona, Character, Accessibility

- [ ] S12: bad news gets empathetic reply, mood changes to concerned, mood tag hidden
- [ ] S13: sincere "are you a real person?" gets AI disclosure
- [ ] Same question in two moods gets two tones
- [ ] Chibi character reacts to each mood (not built yet)
- [ ] S17: reduced motion stops orb and character animation, content stays readable
- [ ] Animation pauses when tab is hidden (not built yet)

### 12.5 Web: Memory and Referral

- [ ] New thread sends only the last 10 messages
- [ ] S21: fact saved in Memory panel appears in next system prompt
- [ ] Deleting one memory removes it from store and cache
- [ ] Clear All Memory wipes brain and memory items
- [ ] Referral: `?ref=` captured and claimed at signup
- [ ] Referral reward only after activity (email verified or first voice session)
- [ ] S15: self-referral and repeat account give zero reward

### 12.6 Web: Account, Legal, Marketing

- [ ] S16: account deletion removes user, sessions, linked data, and logs out
- [ ] Marketing pages load without JavaScript: index, features, pricing, about, contact, referral, privacy, terms
- [ ] Marketing light and dark theme toggle
- [ ] Privacy policy lists every stored field
- [ ] No console errors on Landing, Auth, and Chat

### 12.7 Backend and Security

- [ ] Unauthenticated request to a user-data route is rejected
- [ ] Forged user ID in body is ignored
- [ ] Auth route returns 429 after limit
- [ ] CORS request from unknown origin is refused
- [ ] Log sample contains no message text or email
- [ ] Backend auth and quota tests pass
- [ ] Global daily cap triggers downgrade path

### 12.8 Android: Shell and Core

- [ ] A1: app opens Chat over HTTPS, splash shows, back button behaves (confirm exit on root)
- [ ] A2: guest and magic-link sign-in work inside the app
- [ ] A3: `share`, `openExternal`, `getAppVersion` work from the web app
- [ ] A4: spoken input lands in composer, permission denial shows typed fallback
- [ ] S3: first launch shows Auth screen
- [ ] S16: account deletion works inside the app
- [ ] S18: low-memory device disables heavy features with a message, chat and voice still work
- [ ] No network: error screen offers Retry and Open in browser

### 12.9 Android: Agent Layer

- [ ] Settings > Agent section appears only in the Android app
- [ ] Permission status in Settings matches real state after Grant (refreshes on return)
- [ ] `call`: confirm dialog shows masked number, Cancel returns `cancelled`, Call with denied permission returns `denied`
- [ ] `open_app`: allow-listed app opens, non-listed package returns `invalid`
- [ ] `open_url`: https link opens in browser, `javascript:` or `file:` rejected
- [ ] `set_alarm` and `set_timer` create entries in the clock app
- [ ] `share_whatsapp`: prefilled WhatsApp composer opens, falls back to share sheet when WhatsApp is missing
- [ ] Vault: saved value survives app restart and is not shown in the web UI
- [ ] Vault: ref in action args resolves on-device and action returns status only
- [ ] Vault: no secret value in logcat, network requests, or screenshots
- [ ] Shield: enabling with Usage access and Display over other apps blocks Instagram or YouTube within about 1 second
- [ ] Shield: "Back to Pico" returns to the app, Pico itself is never blocked
- [ ] Shield: disabling a preset removes the block without restart
- [ ] Shield: missing permission leaves the shield off and shows a clear state

## 13. Diagrams and Cache Checklist

- [ ] S22: Mermaid flowchart renders after reply completes, with zoom and pan
- [ ] Mermaid chunk starts loading during streaming, not after the reply
- [ ] Failed Mermaid load shows the diagram source as a code block
- [ ] Diagram with script tags does not execute
- [ ] S23: second identical single-turn question makes no provider call within 24 hours
- [ ] Requests with memory or attachments are never cached
- [ ] Expired cache entry is not returned
