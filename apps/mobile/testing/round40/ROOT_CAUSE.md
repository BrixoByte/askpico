# Round 40 — Root cause (draft, not approved)

## Layer chain per turn (production, old stt.ts, flag OFF)
1. Speaker to phone mic: audio reaches phone (step 2 energy 0.05–0.07; step 3 weaker 0.015). Not the blocker in step 2.
2. Recognizer: partial speech arrives, then ends with error 7 (NO_MATCH) without a final result (step 3, 22:30:19). This is the first failing layer in step 3. (Confirmed by logcat/console.)
3. Final result path: works when a final result arrives (step 2: 22:25:41 final result, submit turn 22:25:42).
4. Chat request: /api/chat returned 429 in step 2 (22:25:45, ttfb 3419 ms). Body not captured. Cause UNKNOWN (rate limit vs daily cap vs upstream busy).
5. TTS: not reached in any voice turn (no reply after step 2 and step 3). Not confirmed or rejected.
6. Re-arm after no-final-result window: not present in production stt.ts (confirmed by round39 notes: the re-arm fix exists only in local flag-ON build).

## Hypotheses
| ID | Hypothesis | Status | Evidence |
|---|---|---|---|
| H-A | Recognizer busy (no release) | Rejected for step 3: a new start is invoked (22:29:48) and speech is detected; no BUSY error logged | DEBUG_TAP.txt 22:29:48–22:30:19 |
| H-B | Recognizer ends too early (NO_MATCH after partial speech), no re-arm | CONFIRMED (step 3) | DEBUG_TAP.txt 22:30:19 error 7 after partials |
| H-C | Output never happens | Partly: no reply in voice turns because no final result (step 3) or 429 (step 2). Not an output-layer fault | DEBUG_TAP.txt 22:25:45 429 |
| H-D | TTS speaks but no audio | Not tested (no TTS event in any run) | — |
| H-E | Phone mic does not get speaker audio | Rejected for step 2 (energy 0.05–0.07 during speech); weaker in step 3 but speech detected | s2_mic.wav, s3_mic.wav |
| H-F | Bridge/page state | Not observed: page stayed, bridge present (picoBridgeSpeak function), no exceptions in tap | DEBUG_TAP.txt (no EXCEPTION lines) |
| H-G | Backend/LLM | Text path OK (200s). Voice path 429 once (step 2), cause unknown | DEBUG_TAP.txt 22:23, 22:25 |

## Proposed fix (NOT applied; needs owner approval)
Scope: stt.ts Android bridge only (onEnd re-arm). Smallest change: in onEnd, when wantRunning is still true and there is no final result (partial-only window), re-arm with cooldown 1.5 s, cap 3 per session, reset counter on onResult. Same as the approved round-39 change, which is in the local bundle but not in production.
- Touches stt.ts: YES (approval required). Does NOT touch MainActivity idle-restart logic.
- Unit test (fails before, passes after): stt.rearm.test.ts "re-arms after a partial-only window" (already written in round 39; 8/8 pass locally).
- Risk: more recognizer starts per session (bounded by cap 3); possible extra "listening" time when user is silent.

## Unresolved (needed before final fix)
- 429 on /api/chat: capture body with the hook on the next voice turn that reaches the chat endpoint (hook is injected in the page; not yet triggered).
- TTS path: needs one turn that produces a reply.
