# P4_SUMMARY — dev-only laptop TTS + production TTS status

## Part 1 — dev-only laptop TTS flag

There was **no client switch** — the laptop provider existed only server-side behind `TTS_SERVICE_URL`. Added a client override:

- **New `apps/web/src/voice/devLaptopTts.ts`** — `devLaptopTtsUrl()` returns the laptop service URL **only when `import.meta.env.DEV` AND `VITE_DEV_LAPTOP_TTS === 'true'`**; otherwise null. Env is injectable for tests. Default URL `http://localhost:8787/tts`, overridable via `VITE_LAPTOP_TTS_URL`.
- **`tts.ts`** — `fetchServerAudio` resolves `devLaptopTtsUrl() ?? TTS_ENDPOINT` per call. In laptop mode it posts `{text, voice}` (the server-side laptop schema — `laptopProvider` expects `voice`, not `lang`) and skips the auth bearer (local service).
- **Release safety:** `import.meta.env.DEV` is false in production builds → override is dead code there. Verified: `DEV:false + flag:'true'` → null (test).
- **Prod dist check:** `VITE_DEV_LAPTOP_TTS`, `VITE_LAPTOP_TTS_URL`, `localhost:8787` → **0 occurrences** in the deployed `index-52a1ae81.js` (and the flag only exists inside the guarded function in the new build).

## Part 2 — production TTS status (read only)

Provider chain in `services/api/src/tts.js` (`providers` = `TTS_PROVIDERS` or `'edge,laptop'`):

| Provider | Env needed | Default when unset |
|---|---|---|
| `edge` | `EDGE_TTS_ENABLED === 'true'` (literal) | **off** — `edgeEnabled=false` (tts.js:28) |
| `laptop` | `TTS_SERVICE_URL` | **off** — `laptopUrl=''` → provider null (tts.js:30,167) |

Other knobs: `TTS_VOICE` default `en-US-AriaNeural`; admin flags `voice_enabled` (default true), `tts_primary` (default null); `synthesize` returns null when no provider → `server.js:1261` → **503 `tts_unavailable`** → client falls back to browser/native speech.

### Live check — `GET /api/tts/status` (production, read-only)
```json
{"enabled":false,"providers":[],"voice":"en-US-AriaNeural"}
```
**Neither `EDGE_TTS_ENABLED` nor `TTS_SERVICE_URL` is set in production.** Every reply TTS call returns 503 and every reply is spoken by the browser/native voice — this explains the round-52 "TTS sometimes 503" symptom (it is actually *always* 503).

**Recommendation:** owner should set `EDGE_TTS_ENABLED=true` (and/or `TTS_SERVICE_URL`) in Railway for the API service, then re-run a voice turn and re-check `/api/tts/status`.

## Tests — 5/5 pass (`devLaptopTts.test.ts`)
unset flag in dev → null · prod build + flag → null · prod build + flag + no URL → null · dev + flag + URL → URL · dev + flag + no URL → localhost:8787 default.
