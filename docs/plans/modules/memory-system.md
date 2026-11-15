# Pico Memory System

**Status:** Planning
**Owner:** Pico product team
**Related:** [Beta launch](../product/beta-launch.md) · [Android app](../engineering/android-app.md) · [Database](../engineering/database.md) · [Voice mode](voice-mode.md) · [Pico vault](pico-vault.md)

## 1. Purpose

Pico remembers two kinds of things: the conversation right now, and facts from the past. This document defines the three-layer memory design that keeps every prompt small, fast, and inside the $50/month API budget while still letting Pico recall old decisions across threads and voice sessions.

## 2. Architecture overview

```
                   ┌──────────────────────────────────────┐
                   │  LAYER 1: GLOBAL BRAIN               │
                   │  User profile, rules, project facts  │
                   │  Always injected into the prompt     │
                   └──────────────────┬───────────────────┘
                                      │
            ┌─────────────────────────┴─────────────────────────┐
            ▼                                                 ▼
┌──────────────────────────────┐          ┌──────────────────────────────┐
│  LAYER 2: SHORT-TERM WINDOW  │          │  LAYER 3: LONG-TERM MEMORY   │
│  Last 10 messages of the     │          │  Supabase pgvector archive   │
│  active thread / voice call  │          │  searched only when needed   │
└──────────────────────────────┘          └──────────────────────────────┘
```

| Layer | Storage | Scope | When it loads |
|---|---|---|---|
| **Global Brain** | Supabase `user_brain` + local cache | All threads and voice | Every turn, always |
| **Short-Term Window** | Room DB (Android) / IndexedDB (web) | One thread or voice session | Every turn, last 10 messages |
| **Long-Term Memory** | Supabase `memory_items` (pgvector) | All history, all threads | Only on semantic match ≥ threshold |

## 3. Layer 1 — Global Brain

A small, structured profile that is always present in the system prompt. Not a message archive — a curated fact store.

```json
{
  "user_profile": {
    "name": "Ahtasham",
    "role": "Solo developer",
    "primary_stack": ["React", "Kotlin", "Tailwind", "Supabase"]
  },
  "product_rules": {
    "monthly_budget_cap": 50.00,
    "brand_name": "Brixo Byte",
    "plans": "Free, Weekly Pass PKR 299, Pro PKR 1,499"
  },
  "active_projects": ["PICO"]
}
```

**Rules**

- Cached locally (Android DataStore / web `localStorage`) at app start. Loads in ~0 ms; no DB read per turn.
- Size target: under 300 tokens so it never eats the context budget.
- User can view, edit, and delete entries in a **Memory panel** inside Profile. Deletion removes it from Supabase and the local cache.
- Updates happen through explicit extraction (see §6), never by dumping raw chat into the profile.

## 4. Layer 2 — Short-Term Thread Window

- Each chat thread has its own local message table. When the LLM payload is built, only the **last 10 messages** of the active thread are included.
- Threads stay isolated: while chatting in Thread B, Thread A's messages are never sent unless retrieved through Layer 3.
- Token bound: the window keeps input near ~1–2k tokens per turn, predictable for cost.
- Voice mode uses the same rule with a **Voice Session Buffer** — the last 10–15 spoken turns held in memory while the mic session is live. When the call ends, the turns are written to the thread like normal messages.

## 5. Layer 3 — Long-Term Vector Memory

Messages that scroll out of the window are not deleted — they are embedded and indexed in Supabase pgvector.

- **Table:** `memory_items` (`id`, `user_id`, `chat_id`, `source` (`chat` | `voice` | `brain`), `content`, `embedding vector(1536)`, `created_at`).
- **Retrieval trigger:** a lightweight intent check decides whether a query looks historical or cross-thread (e.g. "pehle kya decide kiya tha", "budget kitna rakha tha"). Only then does a vector search run — not on every message.
- **Threshold:** cosine similarity **≥ 0.78** required for a match to be injected. Below that, nothing is added.
- **Injection:** top 2 matches go into the system prompt under a labeled block, each tagged with its date and thread name so the model can tell old facts apart:

```text
[RETRIEVED CONTEXT]
Source: Thread A, 2026-10-30 — "Decided 26 early coupons for Pro Monthly, expiry Dec 31 2026."
```

- Cross-thread recall works automatically because the index is global: a query in Thread B can surface a chunk from Thread A or from a past voice call.

## 6. Write pipeline (non-blocking)

Speed rule: nothing blocks the reply. All memory writes happen in the background.

1. **Optimistic append:** the new message is written to the local store and shown in the UI immediately.
2. **Window read:** last 10 messages are read locally (~0 ms) into the payload.
3. **Conditional recall:** if the query is historical, run the embedding + pgvector lookup in parallel; otherwise skip it entirely.
4. **Send:** assembled prompt goes to Groq/OpenRouter.
5. **After the reply:** a background worker (WorkManager / `requestIdleCallback`) syncs the new messages to Supabase, generates embeddings on the server, and extracts any durable facts into the Global Brain (with a confirmation step for user-visible facts).

Embedding generation must run **server-side or batched**, never inline while the user waits.

## 7. Local-first caching

Thread open flow:

- Open thread → read from local DB instantly (0–10 ms) → render.
- If local data is missing or stale → fetch from Supabase once, write to local DB, then render.
- Subsequent turns read locally only; Supabase is touched for writes and vector recall, not for chat display.

This keeps voice latency under the ~500 ms target and lets past chats render offline.

## 8. Prompt assembly order

```text
[SYSTEM]
  Layer 1: Global Brain summary          (always)
  Layer 3: Retrieved context block       (only if matched)
[HISTORY]
  Layer 2: Last 10 messages of thread    (always)
[USER]
  Current message
```

Provider and model names never appear in any injected block.

## 9. Cost and token control

| Metric | Short-term window | Long-term recall |
|---|---|---|
| Data scope | Fixed last 10 messages | Top 2–3 matched chunks |
| Runs on | Every turn | Only historical/cross-thread queries |
| Token cost | ~1–2k, bounded | Small and occasional |
| Network calls | Zero extra | One embedding + one vector query |

The sliding window is the main budget protector: a 100-turn thread still sends ~10 messages per turn. Vector recall adds tokens only when genuinely needed, keeping spend inside the $50/month cap.

## 10. Privacy and deletion

- `memory_items` rows carry `user_id` with RLS; deleting a chat deletes its memory chunks via cascade.
- **Clear memory** in Profile wipes Global Brain + all `memory_items` for the user.
- Sensitive items the user marks private should go to the [Pico vault](pico-vault.md), not the brain. Memory items must not contain secrets (passwords, keys, card numbers).

## 11. Milestones

| Step | Work | Done when |
|---|---|---|
| M-A | Message tables + local window (Layer 2) | Payload sends last 10 messages only |
| M-B | `user_brain` table + local cache + Memory panel (Layer 1) | Brain edits reflect in the system prompt |
| M-C | pgvector table + embedding job (Layer 3 write) | Old messages are indexed automatically |
| M-D | Recall path: intent check + similarity search (Layer 3 read) | Cross-thread question retrieves the right chunk |
| M-E | Voice session buffer integration | Voice recalls facts and writes turns back |

Recommendation for beta: **M-A and M-B** land with the Supabase migration; **M-C–M-E** can ship during the beta window or right after, since the UI works without them.

## 12. Risks and mitigations

- **Wrong retrieval:** noisy matches inject irrelevant context. Mitigations: similarity threshold at 0.78 (not 0.75), match cap of 2 chunks, every chunk tagged with date and thread name, and a pre-launch test set of 20–30 queries to confirm irrelevant history is not injected.
- **Brain drift:** stale facts mislead the model. Mitigations: `updated_at` on every fact, replace-on-conflict (a new fact overwrites the old one, never appends), and confirmation before save — facts enter the brain only through explicit user commands or a suggestion the user approves, never from automatic guesses.
- **Embedding cost:** billed per token. Mitigations: `text-embedding-3-small` (~$0.02 per 1M tokens, well under $1 for the whole beta), server-side batched embedding, index only completed turns, never partial streams.
- **Guest users:** guests get Layers 1–2 locally only (IndexedDB/Room). Layer 3 indexing is limited to signed-in users, keeping embedding cost and anonymous-data purge simple.

## 13. Decisions

- **Embedding provider:** `text-embedding-3-small` (1536 dimensions). Practically free at beta scale; a local FastEmbed/ONNX model can be revisited later if offline embedding becomes a requirement.
- **Voice indexing:** per-call summary, not per-turn. Voice turns are short and noisy, so at call end a 2–4 line summary is written to `memory_items` with `source='voice'`. Cheaper and higher retrieval quality.
- **Memory panel UX:** suggestion-confirmation flow. The system proposes an extracted fact; the user taps Save or Dismiss. Saved facts can be viewed and deleted in the panel.
