# Round 63 — Phase 5 diff summary (docs)

Branch: `feat/text-only`. Uncommitted. Stat: **15 files changed, 88 insertions(+), 161 deletions(-)** (docs + README only).

Standard replacement used throughout: "Voice mode removed (text-only beta, round 63). See docs/plans/modules/voice-mode.md for the archived design."

## Edited

| file | change |
|---|---|
| `docs/plans/product/beta-launch.md` | Added top line "Round 63: voice mode removed; beta is text-only." §2 scope row → one line. §4.1 whole section → one line. Stripped voice mentions: summary, landing/chat/profile rows, features.html, routing inputs, Quick tier use, §4.4 mouth sync, §4.5 renamed "Referral" (voice quota bullet + "first voice session" removed), §4.9 cache, scenario rows S4/S5/S9/S10/S11 deleted, M2/M3/M5 milestones, §6.1 priorities (2 voice items removed), §7 exits, §8 permissions/rollback/native-feature, §9 risks (2 voice bullets removed), §11 Voice checklist → one line + voice items in other checklists, §12.2 → one line, A4 + S18 rows |
| `docs/plans/product/feature-catalog.md` | §3 plan table voice limits removed; revenue estimate "free Edge TTS" removed; §4 Voice Roadmap → one line; referral loop voice minutes → activity-based reward; §14 estimate table voice row removed; rows 83/84 (wake word, on-device TTS) marked removed |
| `docs/plans/product/roadmap.md` | No edit needed — voice row already sits in the "Removed" table pointing at the archived module |
| `docs/plans/product/beta-testing.md` | §3 and §5 voice phases → one line each (mood-tag display check kept); "voice" stripped from locked-feature example, cache section, referral timing, S18, iPhone note. Kept the historical `[x]` verified line for `/api/tts/status` (dated 2026-11-10 checkmark — a record, not a plan) |
| `docs/plans/product/play-store-compliance.md` | SpeechRecognizer removed from SDK row; Permissions row: mic removed + note to drop the Play declaration; checklist "microphone" removed; sensitive-data and disclosure rows de-voiced |
| `docs/plans/product/launch-budget.md` | Edge TTS budget row removed |
| `docs/plans/engineering/android-app.md` | Capability-table row → removed marker; beta set "voice" stripped; architecture diagram line removed; Chat/Profile rows; 4 voice bridge method rows removed; "Voice bridge behavior" → one line; mic in permission order; `RECORD_AUDIO` row removed; mic disclosure bullet removed; native-feature + fallback wording; A4 milestone → one line; voice test bullet + WebView-speech-gap risk removed |
| `docs/plans/engineering/authentication.md` | "mic" stripped from home-screen description, HomeComposer comment, "voice balance" → removed |
| `docs/plans/engineering/telemetry-and-feedback.md` | "voice audio" from non-capture list, `voice_started` breadcrumb, `voice` from feature_used enum, `voice_session` event row, "voice session" interrupt clause |
| `docs/plans/engineering/database.md` | Voice quota line → removal note stating `voice_usage` and related columns remain in DB unused. `memory_items source ('chat'|'voice'|'brain')` enum kept — still exists in the DB |
| `docs/plans/security/README.md` | "voice input" and "voice quota" mentions removed |
| `docs/plans/security/data-protection.md` | "voice minutes" → tokens only |
| `docs/plans/security/threat-model.md` | Voice audio asset row removed; T1 "voice quota" → quota |
| `docs/plans/security/api-security.md` | "voice, TTS" removed from rate-limit list |
| `README.md` | Guest voice-trial bullet → one removal line |
| `docs/README.md` | "JS and voice bridges" → "JS bridges" |

## Deliberately untouched

- `docs/plans/modules/voice-mode.md` — protected archive (verified: 0-line diff).
- `docs/VOICE_MODE.md` — untracked rebuild guide; still `??` in git status.
- `docs/plans/modules/memory-system.md`, `agent-persona.md` — module design archives (voice mentions are part of the archived design; `source='voice'` DB enum still exists).
- `docs/plans/product/beta-progress.md` — dated status snapshot (report-style).
- `docs/ADMIN_PANEL_REPORT.md` — WIP admin report.
- `apps/mobile/{last-chat,remember,fix}.md` — dev-session notes (history).
- `bookmark.md`, `architecture/diagrams/AGENTS.md`, `branching-strategy.md` — research notes / diagram enum / branch-name examples.
- `feature-catalog.md` "Voice note noise reducer" rows — a different feature (audio-file tool).
- `apps/marketing/**` — out of scope. `testing/**` round reports — history.
- `README.md:211` modules listing keeps "voice mode" — the module doc exists (as the archive).

## STOP — Phase 5 complete. Next: Phase 6 verification, then FINAL_REPORT.md.
