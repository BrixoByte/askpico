# Round 64 — Track A remainder inventory

Grep run on `feat/text-only` (post round-63). Excluded: node_modules, dist, .git,
`docs/plans/modules/voice-mode.md`, `docs/VOICE_MODE.md`, `apps/mobile/testing/round*/`,
WIP dirs (`apps/admin-next`, `apps/admin`), `apps/marketing` (out of scope).

## REMOVE — code

| Path | Line | Hit | Action |
|---|---|---|---|
| `apps/web/tsconfig.json` | 28 | `"@voice/*": ["./src/voice/*"]` | dead alias for deleted dir — remove line |
| `apps/web/vite.config.ts` | 100 | `'@voice/'` alias | dead alias — remove line |
| `services/api/package.json` | 16 | `"msedge-tts": "^2.1.1"` | voice-only dep — remove; regenerate `services/api/package-lock.json` (node_modules entry at lock 1375) |
| `services/api/src/server.js` | 553 | comment "…so the guest-trial cap shares the same keyed hash" | stale comment (cap removed) — reword to referral-signup logging |

## REMOVE — architecture (tracked, describes removed code as current)

| Path | Hit | Action |
|---|---|---|
| `architecture/diagrams/voice-pipeline.mmd` | entire file is the voice call-flow diagram | delete file |
| `architecture/diagrams/request-flow.mmd` | "Voice turn state machine" (idle/listening/thinking/speaking) | delete file |
| `architecture/diagrams/api-backend.mmd` | `VOICEP`, `TTSEP` nodes + edges; `QUOTA` desc mentions voice quota | remove nodes/edges, fix desc |
| `architecture/diagrams/pico-architecture.mmd` | `TTS` node + `SRV --> TTS` edge | remove |
| `architecture/diagram.mmd` | `TTS` node + `SRV --> TTS` edge | remove |
| `architecture/js/data/templates.js` | TTS node + edge in 2 templates; "Voice assistant states" template | strip TTS nodes; replace/remove voice-state template |
| `architecture/js/style/engine.js` | `'voice'` in `ROLE_ORDER` | remove enum entry (no diagram uses it after cleanup) |
| `architecture/diagrams/AGENTS.md` | `'voice'` in `role` enum list | remove from list |

## REMOVE — docs (describe voice as current/planned, not as archive)

| Path | Line(s) | Hit | Action |
|---|---|---|---|
| `docs/README.md` | 21 | voice-mode.md index row reads as current plan | mark archived |
| `docs/plans/product/roadmap.md` | 4, 166, 220 | voice features listed as planned (Nov 2026 row) | mark removed/archived |
| `docs/plans/engineering/authentication.md` | 47, 120, 150, 156 | `voice_ledger` table + "Mic button" row + reward writes as current spec | remove/mark archived |
| `docs/plans/engineering/agent-development.md` | 11, 231 | voice features listed as out-of-phase spec | mark removed/archived |
| `docs/plans/modules/memory-system.md` | 9, 25, 31–32, 67, 83, 105, 146, 160 | voice session/buffer described as current design | update narrative to text-only; keep `source` enum value `'voice'` (column exists in DB — see KEEP) |
| `docs/plans/product/feature-catalog.md` | 11, 231, 238, 341, 490, 550, 588 | remaining refs treating voice features as catalog items | annotate as archived (keep "Voice note noise reducer" product rows — non-voice-mode items) |
| `README.md` | 211, 218 | module index + unchecked "Voice input and output" item | mark archived/removed |

## KEEP (verified non-voice or intentionally retained)

| Path | Reason |
|---|---|
| `apps/web/src/api/api.ts`, `apps/web/src/hooks/useSubmit.ts` `requestType` | constant `'text'` — API contract field, backend ignores; not voice code |
| `services/api/src/routingRules.js`, `orchestrator.js` | "invoice(s)" word-parts — false positives |
| `services/api/src/localHealth.js` | `process.hrtime` event-loop lag sampler — unrelated |
| `services/api/test/guestTrialIp.test.js` | tests `hashSignal` — still used by referral signup fraud logging |
| `apps/web/yarn.lock`, `apps/web/package-lock.json` | integrity-hash substring hits only |
| `supabase/migrations/0008,0011,0013,0014` (tracked) | applied migration history — left as-is ("migrations going forward" only) |
| `supabase/migrations/0012,0015–0017` | untracked WIP — do not touch |
| `memory_items.source` enum `'voice'` in `database.md`/`memory-system.md` | real column constraint in DB — schema fact until Track B decides |
| `apps/mobile/last-chat.md`, `remember.md` | owner working notes / history |
| `bookmark.md` | research bookmark notes |
| `docs/ADMIN_PANEL_REPORT.md`, `docs/plans/product/beta-progress.md` | historical reports — deliberately kept in round 63 |
| `docs/plans/product/beta-testing.md:27` | historical verified checklist line |
| `docs/plans/engineering/branching-strategy.md` | `feature/voice-mode` used only as naming-convention example |
| `architecture/PLAN.md`, `architecture/TESTING.md` | build-log/test-instruction text; `TESTING.md` example path updated to an existing diagram |
| All "Voice mode removed (text-only beta, round 63)" lines + links to `docs/plans/modules/voice-mode.md` | intentional archive pointers from round 63 |
| `apps/mobile/app/src/main` | 0 hits (already clean) |
