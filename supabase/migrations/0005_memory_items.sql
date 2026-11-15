-- Layer 3 vector memory (cross-thread recall): per-turn embeddings indexed
-- for semantic search. The match_memory_items RPC powers [RETRIEVED CONTEXT].
create extension if not exists vector;

create table if not exists memory_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chat_id text not null,
  source text not null default 'chat',
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_items_user
  on memory_items (user_id, chat_id, created_at desc);

create index if not exists idx_memory_items_embedding
  on memory_items using hnsw (embedding vector_cosine_ops);

alter table memory_items enable row level security;

create policy "own memory items" on memory_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Cosine similarity search over a user's own memory items.
-- Called by the backend with the service role; p_user_id scopes the search.
create or replace function match_memory_items(
  p_user_id uuid,
  p_query vector(1536),
  p_threshold float default 0.78,
  p_count int default 2
)
returns table (chat_id text, content text, created_at timestamptz, similarity float)
language sql
stable
set search_path = public
as $$
  select
    m.chat_id,
    m.content,
    m.created_at,
    1 - (m.embedding <=> p_query) as similarity
  from memory_items m
  where m.user_id = p_user_id
    and m.embedding is not null
    and 1 - (m.embedding <=> p_query) >= p_threshold
  order by m.embedding <=> p_query
  limit p_count;
$$;
