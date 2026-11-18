# P2_DIFF — B1 Android partial flush

**Status: already implemented and deployed** — landed in `c26eeb3` / `aa38992` (round 54 work, owner-approved). No new diff this round; verified live in the production bundle (`lowConfidence` marker present).

## Implementation (existing, stt.ts only)
- `pendingPartial` retains the last Android interim per window; `androidWindow` id per `startVoiceInput`.
- `onEnd` (wantRunning branch): ≥2-word pending partial → log `{window, words, lowConfidence:true}` (no text) → `closeListeningWindow` → `onUtterance(text, {lowConfidence:true})` → `finish(true)`. Else existing re-arm/cap.
- `flushedWindow` guard ignores a late final for the same window — no double submit.
- Optional `mayFlushPartial` veto hook in `SttHandlers` — session-level echo/grace wiring is a documented open point (needs a 1-line session.ts change; protected-file policy at the time).
- Tests: `stt.partialFlush.test.ts` (7) + updated `stt.rearm.test.ts` — all passing in the 415-test suite.
