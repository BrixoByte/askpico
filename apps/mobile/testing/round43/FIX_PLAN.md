# Round 43 — Fix plan (NOT applied — awaiting owner approval)

## Design

1. **Marker**: already exists — client sends `requestType:'voice'` (useSubmit.ts pendingVoiceTurn
   → api.ts → body). No client change needed. Missing/unknown → `'voice'` check fails → text
   behaviour (cap applies). Safe default preserved.
2. **Token-cap check** (`/api/chat`, server.js ~171-186): skip when `requestType === 'voice'`.
   Voice gate at line 188 stays and still enforces voice seconds.
3. **Token recording** (`recordRequest`, server.js:93): for `feature === 'voice'` send
   `p_prompt_tokens: 0, p_completion_tokens: 0` to `log_request`, while keeping the real
   `p_cost_usd`. Result: `tokens_used_today` is NOT incremented for voice; the `request_logs`
   row is still inserted (guest daily-count + circuit-breaker cost accounting unchanged);
   `ai_usage` keeps the real token counts via `logLlmCall` (feature='voice') — cost ledger intact.
   One change covers `/api/chat` (lines 338/365) and `/api/agent/chat` (line 1077).
4. **Guest rules unchanged**: guest 30 msgs/day counts `request_logs` rows (still inserted);
   guest voice trial unchanged (voiceTurnQuotaCheck path untouched).
5. **No SQL / no schema change / no migration required** — all logic stays in JS.

## Files touched

| File | Change | stt.ts/MainActivity idle-restart? |
|------|--------|-----------------------------------|
| `services/api/src/tokenQuotaPolicy.js` | Add pure helpers: `shouldCheckTokenCap(requestType)` and `requestLogTokens(feature, prompt, completion)` | no |
| `services/api/src/server.js` | `/api/chat`: gate the token-cap block behind `shouldCheckTokenCap(requestType)`; `recordRequest` uses `requestLogTokens(feature, …)` | no |
| `services/api/test/voiceTokenCap.test.js` (new) | unit tests for both helpers | no |
| `apps/web` | none — marker already sent | no |
| stt.ts / MainActivity.kt | none | n/a |

## Planned tests (services/api/test/voiceTokenCap.test.js)

- `shouldCheckTokenCap`: 'voice' → false; 'text'/undefined/'banana' → true
  (covers: missing/unknown mode defaults to text behaviour)
- `requestLogTokens('voice', p, c)` → `{ prompt: 0, completion: 0 }` (voice turn does not
  increase tokensUsed)
- `requestLogTokens('text', p, c)` → real values; unknown feature → real values
- Existing suites already cover: voice-quota-exhausted → 403 (voiceTurnGate.test.js) and
  guest rules unchanged; full `npm test` + routing.test.js env status reported.

## Diff sketch (exact code in review)

```js
// tokenQuotaPolicy.js (append)
export const shouldCheckTokenCap = (requestType) => requestType !== 'voice';
export const requestLogTokens = (feature, promptTokens, completionTokens) =>
  feature === 'voice'
    ? { promptTokens: 0, completionTokens: 0 }
    : { promptTokens: Math.max(0, Math.round(promptTokens)),
        completionTokens: Math.max(0, Math.round(completionTokens)) };

// server.js /api/chat
try {
  const plan = await getUserPlan(user.id);
  const { data: tokensToday, error: tokensErr } = await supabase.rpc('roll_daily_tokens', { p_user_id: user.id });
  if (tokensErr) throw new Error(tokensErr.message);
  if (shouldCheckTokenCap(requestType) && isDailyTokenCapReached(plan, Number(tokensToday ?? 0))) { …429… }
}

// server.js recordRequest — single change, covers chat + agent chat
const { promptTokens: rpcPrompt, completionTokens: rpcCompletion } =
  requestLogTokens(feature, promptTokens, completionTokens);
// …rpc('log_request', { …, p_prompt_tokens: rpcPrompt, p_completion_tokens: rpcCompletion, p_cost_usd: real })
```

## Verification plan (after approval)
- Gates: tsc, yarn test, yarn build (apps/web), npm test (services/api, counts).
- Local: test account voice turn → `tokens_used_today` unchanged, `voice_seconds_used_today`
  increases; text message under cap → still 429 QUOTA_EXHAUSTED. Numbers only, read-only checks.

## Stop — waiting for owner approval to apply.
