# Round 63 — Phase 5 docs inventory

Grep: `voice|speech|tts|mic|RECORD_AUDIO|dictation|barge` over tracked `.md` files (excluding `testing/` round reports). Classification: EDIT = describes voice as a current/shipping feature; KEEP = archive link, design module, historical/snapshot, different feature, or out of scope.

## EDIT (describes voice as current)

| file | lines | what |
|---|---|---|
| `README.md` | 80 | guest 2-min voice trial stated as current server behavior |
| `docs/README.md` | 30 | android doc described as "JS and voice bridges" |
| `docs/plans/product/beta-launch.md` | 4,11,19,41,43,52,53,69,86-105,113,115,141,182,187-191,246,260-267,286-289,301-303,309,313,323,351,355,359-362,379-385,400,410-411,418,443,446,471-481,510 | §2 scope, §4.1 whole voice section, plan/quota/scenario/milestone/checklist rows |
| `docs/plans/product/feature-catalog.md` | 25-28,32,34-37,44,410-413,614 | plan voice quotas, §4 Voice Roadmap, referral minutes, estimate table, wake-word row |
| `docs/plans/product/roadmap.md` | 220 | voice items grouped into one plan (row describes planned current work) |
| `docs/plans/product/beta-testing.md` | 27,46,83-91,102,107-118,153,169 | voice test phases/scenarios as current test plan |
| `docs/plans/product/play-store-compliance.md` | 21,22,113,126,127 | RECORD_AUDIO/mic permission and disclosure rows |
| `docs/plans/product/launch-budget.md` | 36 | Edge TTS budget row (voice fallback chain) |
| `docs/plans/engineering/android-app.md` | 18,37,49,81,82,97-100,111-115,159,193,223,229,230,239,258,269 | voice bridge as shipped feature, RECORD_AUDIO, mic disclosure |
| `docs/plans/engineering/telemetry-and-feedback.md` | 28,34,64,66,148 | voice audio/voice_session telemetry as designed-current |
| `docs/plans/engineering/database.md` | 251-252 | voice_usage quota table; memory_items source='voice' enum note |
| `docs/plans/engineering/authentication.md` | 14,94,171 | mic in composer description, "voice balance" check |
| `docs/plans/security/README.md` | 9,23 | voice input/quota in security posture |
| `docs/plans/security/data-protection.md` | 16 | "voice minutes" usage counts |
| `docs/plans/security/threat-model.md` | 16,30 | voice audio asset row, voice quota threat row |
| `docs/plans/security/api-security.md` | 67 | voice/TTS in rate-limit list |

## KEEP (deliberately untouched)

| file | reason |
|---|---|
| `docs/plans/modules/voice-mode.md` | protected archived design — never edited |
| `docs/VOICE_MODE.md` | untracked rebuild guide — stays untracked |
| `docs/plans/modules/memory-system.md` | module design archive; `source='voice'` enum still exists in DB |
| `docs/plans/modules/agent-persona.md` | module design archive |
| `docs/plans/product/beta-progress.md` | dated status snapshot (report-style, like round reports) |
| `docs/ADMIN_PANEL_REPORT.md` | report on WIP admin work (WIP dirs must not be touched) |
| `apps/mobile/last-chat.md`, `remember.md`, `fix.md` | dev-session notes — history |
| `bookmark.md` | third-party repo evaluation notes (research) |
| `architecture/diagrams/AGENTS.md` | `voice` is a diagram-role enum, not a feature claim |
| `docs/plans/engineering/branching-strategy.md` | `feature/voice-mode` used only as branch-naming example |
| `docs/plans/product/feature-catalog.md` "Voice note noise reducer" rows | different feature — an audio-file tool, not voice mode |
| link lines to `../modules/voice-mode.md` (roadmap L4/L166, feature-catalog L5/L11/L36/etc.) | links already point at the archived design |
| `apps/marketing/**` | out of scope |
| `apps/mobile/testing/**` | round reports — history |
| `README-zh_CN.md`, `apps/web/README.md`, `apps/web/THEME.md`, `architecture/*` | no voice hits |

## Replacement text (per plan)

"Voice mode removed (text-only beta, round 63). See docs/plans/modules/voice-mode.md for the archived design."
