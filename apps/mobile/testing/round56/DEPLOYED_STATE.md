# DEPLOYED_STATE — round 56 step 0

## Served bundle vs local dist
- Production: `assets/index-52a1ae81.js` on https://go.askpico.app
- Local `apps/web/dist`: `assets/index-52a1ae81.js` — **MATCH** (dist is the exact deployed flag-OFF build)

## Feature markers in the served bundle
| Feature | Marker | Present? |
|---|---|---|
| B2 bounded follow-up window | `follow-up window expired` | yes (1x) |
| B3 barge-in | `Barge-in confirmed` | yes (1x) |
| Tap-after-cap stop | `Voice stopped` | yes (1x) |
| B1 partial flush | `lowConfidence` | yes (1x) |
| Post-TTS listening resume | `Resuming listening` | yes (1x) |
| Signed-in heartbeat | `sendVoiceHeartbeat` path | yes (in P3 code, round 54/55) |

## Commits
- `aa38992` — merge feat/voice-phase-b-b1-heartbeat into develop (= origin/develop)
- `c26eeb3` — feature commit
- `aec13e5`, `9095ade`, `c9f33ef` — prior history

## Verdict
All approved voice fixes (B1, B2, B3, tap-after-cap, signed-in heartbeat) are **live in production**, deployed via Cloudflare Pages deployment `66d8066a-c011-499d-bc51-30c82aaa1b46` at commit `aa38992`. B2/B3 markers present — continuing to Step 1.
