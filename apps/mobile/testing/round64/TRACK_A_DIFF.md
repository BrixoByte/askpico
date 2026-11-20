# Track A — repo remainder diff (round 64)

Branch `feat/text-only`. Round-63 removals already in the working tree; this file covers only
the round-64 remainder (see `REMAINDER.md` for the full classification table).

## Removed / edited — code

| File | Change |
|---|---|
| `apps/web/tsconfig.json` | removed dead `@voice/*` path alias |
| `apps/web/vite.config.ts` | removed dead `@voice/` resolve alias |
| `services/api/package.json` | removed `msedge-tts` dependency (voice-only) |
| `services/api/package-lock.json` | regenerated — `msedge-tts` entries dropped |
| `services/api/src/server.js` | stale comment reworded (`hashSignal` now described as referral abuse hashing) |

## Removed — architecture

| File | Change |
|---|---|
| `architecture/diagrams/voice-pipeline.mmd` | deleted (entire diagram was the voice call flow) |
| `architecture/diagrams/request-flow.mmd` | deleted (voice turn state machine) |
| `architecture/diagrams/api-backend.mmd` | removed `VOICEP` + `TTSEP` nodes/edges; `QUOTA` node/desc no longer lists voice quota or `debitVoiceQuota` |
| `architecture/diagrams/pico-architecture.mmd` | removed `TTS` node + `SRV --> TTS` edge |
| `architecture/diagram.mmd` | removed `TTS` node + `SRV --> TTS` edge |
| `architecture/js/data/templates.js` | removed `TTS` node + edge from both starter templates; "Voice assistant states" template → "Chat request states" (send/stream flow); mindmap `Voice` leaf removed |
| `architecture/js/style/engine.js` | `'voice'` removed from `ROLE_ORDER` (no diagram uses it now) |
| `architecture/diagrams/AGENTS.md` | `'voice'` removed from the `role` enum |
| `architecture/TESTING.md` | live-edit example path `request-flow.mmd` → `pico-architecture.mmd` (deleted file reference) |

## Edited — docs (voice no longer described as current/planned)

| File | Change |
|---|---|
| `docs/README.md` | voice-mode index row marked archived |
| `docs/plans/product/roadmap.md` | voice roadmap row → "Removed — round 63"; mood-tag guardrail line annotated |
| `docs/plans/product/feature-catalog.md` | intro/next-steps/index/risk/source-list refs annotated removed+archived; feature-66 row marked removed |
| `docs/plans/engineering/authentication.md` | `voice_ledger` annotated unused; "Mic button" row marked removed; referral reward step reworded |
| `docs/plans/engineering/agent-development.md` | voice system spec reference → archived; out-of-scope feature list drops voice features (kept numbers for cross-ref) |
| `docs/plans/modules/memory-system.md` | voice session/buffer passages marked archived; `memory_items.source` `'voice'` enum kept (historical rows may exist) |
| `README.md` | module index annotated; roadmap checkbox replaced with struck-through removed item |

## Kept (verified)

- `requestType` constant `'text'` in `api.ts`/`useSubmit.ts` — API contract, not voice code.
- `hashSignal` in `guestTrialIp.js` + its test — used by referral signup fraud logging.
- Tracked migrations 0008/0011/0013/0014 — applied history; "migrations going forward" only.
- `memory_items.source` `'voice'` enum mention — real DB constraint (Track B decision).
- Historical notes/reports: `last-chat.md`, `remember.md`, `bookmark.md`, `ADMIN_PANEL_REPORT.md`,
  `beta-progress.md`, `beta-testing.md:27`, `branching-strategy.md` examples.
- All round-63 archive-pointer lines ("Voice mode removed … see docs/plans/modules/voice-mode.md").
- `apps/admin*`, `apps/marketing`, untracked migrations 0012/0015–0017, `navp.mjs`, round57 log — untouched.

## Gates (round 64)

| Gate | Result |
|---|---|
| `npx tsc --noEmit` (apps/web) | **exit 0** |
| `npm test` (apps/web, vitest) | **360/360 pass, 0 fail**, 16 files — i18n/mojibake guard green |
| `npm run build` (flag OFF) | **exit 0** → `index-c2d7b9d0.js` |
| `npm test` (services/api) | **215 pass, 1 fail, 2 todo** — `routing.test.js` env-blocked (`SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` unset), pre-existing |
| `assembleDebug` + `testDebugUnitTest` | **BUILD SUCCESSFUL** (up-to-date tasks; no Kotlin changes this round) |
| merged debug manifest `RECORD_AUDIO` | **absent** |
| residual scan (code + config) | 0 voice hits — only `lastTick`/`hashSignal` KEEP items |

**Working-tree total vs base:** 113 files, +236/−7,656 (includes round-63 work).

**STOP** — awaiting owner `DB` before Track B.
