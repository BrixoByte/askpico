# Round 43 — Trace: why voice turns hit the text token cap

## Call paths (side by side)

### Voice turn (current, buggy)
```
stt.ts final result → session.ts → useSubmit.ts:189 pendingVoiceTurn → requestType='voice'
  → getChatCompletionStream (api.ts:209) POST /api/chat { ..., requestType:'voice' }
  → server.js:157 requestType destructured
  → server.js:171-186  roll_daily_tokens RPC → isDailyTokenCapReached → 429 QUOTA_EXHAUSTED   ← BUG (applies to voice)
  → server.js:188      requestType==='voice' → blockVoiceTurnOverQuota → voice-seconds gate  (correct)
  → server.js:306      feature='voice'
  → server.js:338/365  recordRequest → log_request RPC → request_logs row +
                       profiles.tokens_used_today += prompt+completion                        ← BUG (voice adds tokens)
  → aiUsage.js:157     ai_usage insert (feature='voice', real token counts)                   (correct — keep)
```

### Text turn (current, correct)
```
composer → useSubmit.ts → requestType='text'
  → POST /api/chat { requestType:'text' } (absent = default 'text' behaviour)
  → server.js:171-186  token-cap check applies → 429 when over limit                        (correct)
  → server.js:188      not voice → voice gate skipped                                       (correct)
  → server.js:338/365  recordRequest → log_request → tokens_used_today += tokens             (correct)
  → ai_usage insert (feature='text')                                                        (correct)
```

## Quota systems confirmed separate
- Token cap: `profiles.tokens_used_today` via `roll_daily_tokens` RPC + `log_request` increment
  (migrations 0006/0009). Limit: `dailyTokenLimit(plan)` (tokenQuotaPolicy.js).
- Voice seconds: `profiles.voice_seconds_used_today` via `debitVoiceQuota` (heartbeat billing)
  + `voiceTurnQuotaCheck` per-turn gate (voiceTurnGate.js). Guests: lifetime trial via
  `debitGuestVoice`. Completely separate counters — the bug is only that BOTH apply to voice.

## Key facts
- Voice marker ALREADY exists end-to-end: client sends `requestType:'voice'` (useSubmit.ts:189,
  api.ts:209→214); server reads it (server.js:157). No new marker needed.
- `/api/agent/chat` (server.js:1036+) has the voice gate but NO token-cap check — already
  voice-friendly; its recordRequest (line 1077) also adds voice tokens to the counter.
- `countGuestMessagesToday` counts `request_logs` rows → log_request must STILL insert the row
  for voice turns (guest 30/day depends on it).
- `log_request` also feeds the daily circuit-breaker cost sum → keep real `p_cost_usd`.
- `recordRequest` is the single choke point for token increment — one place to fix all routes.
- stt.ts / MainActivity idle-restart area: NOT involved (fix is server + request plumbing only).
