# AskPico — Development & Testing Report

**Date:** 2026-11-16
**Scope:** Admin panel (Vite, `apps/admin` @ `localhost:5174`), Express API (`services/api` @ `localhost:3001`), Android WebView app (`apps/mobile`).

---

## 1. Kya develop hua (summary)

| # | Feature | Status | Real/Mock |
|---|---------|--------|-----------|
| 1 | Users & Plans page | ✅ Done | Real (Supabase) |
| 2 | Overview + Stats | ✅ Done | Real |
| 3 | AI Spend tracking + budgets + provider sync | ✅ Done | Real |
| 4 | Admin alerts feed (Overview) | ✅ Done | Real |
| 5 | Feature flags + kill switch (live, no redeploy) | ✅ Done | Real |
| 6 | Voice engine health (Edge/Laptop TTS) | ✅ Done | Real |
| 7 | Infrastructure monitoring (Railway + local health) | ✅ Done | Real |
| 8 | Errors & Logs page | ⏳ Mock | `getErrorsData` — last remaining mock |
| 9 | Android WebView error states | ✅ Done | Native classified screens |

---

## 2. SQL Migrations — SQL Editor mein run karni hain (PENDING)

Supabase Dashboard → SQL Editor, order mein:

| File | Kya banata hai |
|------|----------------|
| `supabase/migrations/0012_admin_users_plans.sql` | users indexes + view |
| `supabase/migrations/0013_ai_spend.sql` | `ai_usage`, `model_pricing` (+8 seed), `ai_budgets` (+2), `admin_alerts` |
| `supabase/migrations/0015_feature_flags.sql` | `feature_flags`, `flag_history` + 7 seed flags (0014 already taken tha) |
| `supabase/migrations/0016_voice_health.sql` | `tts_health_checks`, `tts_requests`, `laptop_heartbeat` |

> Saari tables RLS-enabled, service-role-only. Frontend/API response mein koi secret nahi aata.
> Migrations run kiye baghair related endpoints `502 "unavailable"` dete hain — ye designed fail-soft hai, user traffic unaffected rehta hai.

## 3. Env vars — `services/api/.env`

| Var | Required | Notes |
|-----|----------|-------|
| `TTS_HEARTBEAT_SECRET` | Voice heartbeat ke liye | Laptop script isko `x-pico-heartbeat` header mein bhejti hai |
| `AI_BUDGET_KILL_SWITCH=true` | Optional | Default OFF; ON ho to budget breach par `global_kill_switch` |
| `RAILWAY_API_TOKEN` | Infra live data | Railway → Account → Tokens |
| `RAILWAY_PROJECT_ID` | Infra live data | |
| `RAILWAY_SERVICE_ID` | Infra live data | |
| `RAILWAY_ENVIRONMENT_ID` | Infra live data | |

> Railway vars unset hon to infra endpoints `configured:false` + local fallback + `stale:true` dete hain — crash nahi.
> Koi `VITE_` var mein secret kabhi nahi.

---

## 4. Backend structure (new/changed files)

```
services/api/src/
├── flags.js              # getFlag() 15s cache, fail-safe, flagMiddleware (503 kill/maintenance)
├── railway.js            # NEW: GraphQL client — 8s timeout, 2 retries, 25s cache
├── localHealth.js        # NEW: 60s sampler — uptime/RSS/heap/event-loop lag, 24h ring
├── voiceHealth.js        # probes (90s), status rules, heartbeat tracking
├── aiUsage.js            # logLlmCall, budget alerts, provider sync (6h)
├── llmClient.js          # streaming usage capture (stream_options.include_usage)
├── routing.js            # modelsForModeLive() — model_routing flag se
├── tts.js                # probeEngine(), synthesize() request logging + fallback reasons
├── server.js             # /api/health, /api/tts/heartbeat, flag middleware, samplers start
└── admin/
    ├── routes.js         # requireAdmin → mounts sab routers
    ├── flagRoutes.js     # GET/PUT /flags, history, revert (optimistic concurrency → 409)
    ├── voiceRoutes.js    # /voice/health, fallbacks, timeline, failures, probe
    ├── aiSpendRoutes.js  # /ai-spend/* + /alerts
    └── infraRoutes.js    # NEW: /infra/status, metrics, deployments, restarts, local
```

**Rules as config constants:**
- Voice (`voiceHealth.js`): `PROBE_INTERVAL_MS=90s` · `DOWN_STREAK=3` · `DEGRADED_P95_MS=4000` · `DEGRADED_SUCCESS_RATE=0.95` · `FLAP_DEBOUNCE=2` · `HEARTBEAT_STALE_MS=90s`
- Infra (`infraRoutes.js`): `RAM_WARN_PCT=85` · `RAM_DOWN_PCT=95` · `RESTART_DOWN_PER_H=3` · latest FAILED/CRASHED → degraded
- Railway client: `TIMEOUT_MS=8s` · `MAX_RETRIES=2` · `CACHE_TTL_MS=25s`

## 5. Railway API — known limitations

- **Restarts ka dedicated query nahi hai** → `CRASHED`/`FAILED` deployments se derive (`derived:true` flag, UI mein "derived" label)
- Commit info `deployment.meta` se — kuch deploys par `meta` null ho sakta hai → `—`
- Uptime = local `process.uptime()` (Railway restart par reset)
- `metrics` query shape docs se li gayi — **live verify baqi** (env set karke test point 7.x dekho)

## 6. Android app (WebView error states)

- `LoadError.kt` — classifier (pure, testable): `OFFLINE` / `SERVER_UNREACHABLE` / `SERVER_ERROR` / `TIMEOUT` + `RetryGate`
- `MainActivity.kt` — main-frame-only errors, 25s watchdog, `pageLoadedOnce` → mid-session amber banner vs full screen, auto-retry on network VALIDATED, `pico_force_error` debug extra
- 4 theme vector icons, amber banner = web ke amber-100/900/500 same colors
- 15/15 unit tests pass, `assembleDebug` clean
- Screenshots: `apps/mobile/screenshots/error_{offline,server,http500,timeout,real_unreachable}.png`
- **Dark mode:** app DayNight theme nahi hai — light only (existing design)
- Debug hook: `adb shell am start -n com.askpico.pico/.MainActivity --es pico_force_error offline|server|http500|timeout`

---

## 7. TESTING CHECKLIST — kal ke liye

### 7.0 Setup (pehle ye karo)
- [ ] Supabase SQL Editor → 4 migrations run (`0012`, `0013`, `0015`, `0016`)
- [ ] `services/api/.env` mein `TTS_HEARTBEAT_SECRET` set karo
- [ ] `services/api/.env` mein 4 `RAILWAY_*` vars set karo
- [ ] Backend restart: `cd services/api && npm run dev`
- [ ] Admin: `cd apps/admin && npm run dev` → `localhost:5174` → admin Gmail se login

### 7.1 Users & Plans + Overview
- [ ] `/users` — real users list, plan badges, search/sort
- [ ] `/` Overview — stat cards real values; alerts feed (migrations ke baad rows aayengi)

### 7.2 AI Spend
- [ ] `/ai-spend` load — charts, top spenders, projected card
- [ ] App se ek chat bhejo → `ai_usage` mein row (`estimated=false` agar provider usage de)
- [ ] Range switch → charts update; stacked model chart
- [ ] Daily budget ~$0.01 set karo → agle LLM call par `admin_alerts` mein warn row → Overview feed
- [ ] Budget edit → save → `admin_audit_log` row
- [ ] `model_pricing` se ek row delete → "Unpriced models" warning card

### 7.3 Feature Flags (`/flags`)
- [ ] 7 seed flags dikhen (Emergency red group upar)
- [ ] Kill switch ON (type `KILL` confirm) → **customer app ~0s mein 503** · red banner sab admin pages par · `/api/admin` + `/api/health` reachable
- [ ] OFF karo → traffic resume → history drawer mein entries + revert button
- [ ] `voice_enabled` OFF (`DISABLE`) → `/api/tts` null
- [ ] `model_routing` invalid JSON → inline error; unknown model → amber warning; valid → agli chat naye model se
- [ ] Do tabs same flag edit → second save → **409 conflict** banner
- [ ] `daily_request_cap_per_user=1` → 2nd chat → 429
- [ ] `maintenance_mode` ON (`MAINTENANCE`) → user routes 503, admin open

### 7.4 Voice Health (`/voice`)
- [ ] `EDGE_TTS_ENABLED=true` + laptop TTS chal raha ho → 90s probes → cards fill (p95, success 1h/24h)
- [ ] Laptop heartbeat: `curl -X POST http://localhost:3001/api/tts/heartbeat -H "x-pico-heartbeat: $SECRET"` har 30s → laptop card online; laptop band → 90s baad `offline`
- [ ] Secret ke baghair heartbeat → 403
- [ ] App se voice chat → `tts_requests` rows
- [ ] `tts_primary` select → Apply → ConfirmDialog → ~15s baad provider order change
- [ ] Edge band karo → 3 probe fails → card `down` + fallbacks chart
- [ ] Probe button spam → 429 (30s cooldown)
- [ ] Sab engines down → red critical banner

### 7.5 Infrastructure (`/infrastructure`)
- [ ] `RAILWAY_*` set hone par: status banner healthy · real deploys table (status badge, sha, commit) · CPU/RAM charts · RAM limit line
- [ ] `/api/health` ping card → RTT ms + event-loop lag
- [ ] `RAILWAY_API_TOKEN` ghalat → page chale, **STALE DATA** chip + local fallback charts
- [ ] `metrics?range=` 1h/6h/24h/7d switch → charts reload
- [ ] Railway par forced FAILED deploy → banner `degraded`; 3 CRASHED/FAILED/1h → `down`
- [ ] 30s auto-refresh + LastUpdated tick
- [ ] `derived` label restarts card par

### 7.6 Security spot-checks (har page par)
- [ ] Incognito/no-token → `GET /api/admin/*` → 401
- [ ] Non-admin user token → 403
- [ ] Browser DevTools → Network → responses mein koi `service_role` key / Railway token nahi

### 7.7 Android (device)
- [ ] Airplane mode → open app → "You are offline" → airplane off → **auto-retry**
- [ ] Retry tap while offline → inline "Still offline" hint
- [ ] `--es pico_force_error server` → Retry spam → sirf ek reload ("Retrying…")
- [ ] `pico_force_error timeout` / `http500` → sahi screens
- [ ] Loaded app par airplane mode → top amber banner, page replace nahi
- [ ] `assembleRelease` → debug hook disabled
- [ ] Font scale 1.3x → layout intact

### 7.8 Deploy
- [ ] `apps/admin`: `npm run build` → `wrangler pages deploy dist --project-name=askpico-admin`
- [ ] `services/api`: push → Railway auto-deploy → `api.askpico.app/api/health` check
- [ ] Mobile APK: `cd apps/mobile && gradle assembleDebug` → `adb install -r app-debug.apk`

---

## 8. Abhi jo baaki hai

1. **`getErrorsData`** — aakhri mock (Errors & Logs page) — real backend pending
2. Railway `metrics` live verify (env vars ke baad)
3. Infra page read-only hai — restart/redeploy actions baad mein (intentional)
4. Bundle ~941 kB — code-splitting optional improvement

## 9. Deploy targets (reference)

| Cheez | URL |
|-------|-----|
| Customer frontend | `https://go.askpico.app` |
| Admin frontend | `https://admin.askpico.app` |
| API | `https://api.askpico.app` (prod) / `http://localhost:3001` |
| Admin dev | `http://localhost:5174` |
| Railway GraphQL | `https://backboard.railway.com/graphql/v2` |
