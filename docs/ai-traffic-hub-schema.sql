-- AI Traffic Hub schema (Supabase)
-- Table: ai_requests
-- Purpose: store every LLM invocation (success/error), token usage, latency, metadata.

create table if not exists public.ai_requests (
  id text primary key,
  created_at timestamptz not null default now(),
  started_at bigint,
  ended_at bigint,
  latency_ms bigint,
  provider text not null,
  model text not null,
  stream boolean not null default false,
  status text not null check (status in ('success', 'error')),
  error text,
  prompt_tokens integer,
  response_tokens integer,
  total_tokens integer,
  message_count integer,
  prompt_chars integer,
  source text,
  feature text,
  user_id text,
  project_id text,
  metadata jsonb
);

create index if not exists ai_requests_created_at_idx on public.ai_requests (created_at desc);
create index if not exists ai_requests_user_id_idx on public.ai_requests (user_id);
create index if not exists ai_requests_project_id_idx on public.ai_requests (project_id);
create index if not exists ai_requests_feature_idx on public.ai_requests (feature);
create index if not exists ai_requests_model_idx on public.ai_requests (model);

-- Optional: enable RLS if you want client-side read access later
-- alter table public.ai_requests enable row level security;

-- Optional: example policy (client reads only their own user_id)
-- create policy "ai_requests_read_own" on public.ai_requests
-- for select using (auth.uid()::text = user_id);
