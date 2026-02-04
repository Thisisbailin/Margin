-- Margin library schema (projects/documents/sections/blocks) + FTS
-- This schema is designed for Agent on-demand reading in Supabase.
-- NOTE: This version is production-oriented and resets existing test tables.

drop table if exists public.margin_document_blocks cascade;
drop table if exists public.margin_document_sections cascade;
drop table if exists public.margin_documents cascade;
drop table if exists public.margin_projects cascade;

-- Core project table (snapshot)
create table public.margin_projects (
  id text primary key,
  user_id uuid not null,
  name text not null,
  description text,
  lexeme_index jsonb,
  interaction_log jsonb,
  active_document_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table public.margin_documents (
  id text primary key,
  user_id uuid not null,
  project_id text not null references public.margin_projects(id) on delete cascade,
  title text,
  author text,
  language text,
  type text,
  data jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Normalized sections
create table public.margin_document_sections (
  id text primary key,
  user_id uuid not null,
  project_id text not null references public.margin_projects(id) on delete cascade,
  document_id text not null references public.margin_documents(id) on delete cascade,
  title text,
  "order" integer,
  level integer,
  parent_id text,
  source_path text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Normalized blocks with full-text search
create table public.margin_document_blocks (
  id text primary key,
  user_id uuid not null,
  project_id text not null references public.margin_projects(id) on delete cascade,
  document_id text not null references public.margin_documents(id) on delete cascade,
  section_id text not null references public.margin_document_sections(id) on delete cascade,
  block_order integer,
  type text,
  level integer,
  align text,
  indent text,
  indent_kind text,
  line_height text,
  spacing_before text,
  spacing_after text,
  note_type text,
  text text,
  source_ids jsonb,
  search_vector tsvector generated always as (to_tsvector('simple', coalesce(text, ''))) stored,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index margin_document_blocks_search_idx
  on public.margin_document_blocks using gin (search_vector);

-- RLS
alter table public.margin_projects enable row level security;
alter table public.margin_documents enable row level security;
alter table public.margin_document_sections enable row level security;
alter table public.margin_document_blocks enable row level security;

create policy "projects_select_own" on public.margin_projects
  for select using (auth.uid() = user_id);
create policy "projects_write_own" on public.margin_projects
  for insert with check (auth.uid() = user_id);
create policy "projects_update_own" on public.margin_projects
  for update using (auth.uid() = user_id);

create policy "documents_select_own" on public.margin_documents
  for select using (auth.uid() = user_id);
create policy "documents_write_own" on public.margin_documents
  for insert with check (auth.uid() = user_id);
create policy "documents_update_own" on public.margin_documents
  for update using (auth.uid() = user_id);

create policy "sections_select_own" on public.margin_document_sections
  for select using (auth.uid() = user_id);
create policy "sections_write_own" on public.margin_document_sections
  for insert with check (auth.uid() = user_id);
create policy "sections_update_own" on public.margin_document_sections
  for update using (auth.uid() = user_id);

create policy "blocks_select_own" on public.margin_document_blocks
  for select using (auth.uid() = user_id);
create policy "blocks_write_own" on public.margin_document_blocks
  for insert with check (auth.uid() = user_id);
create policy "blocks_update_own" on public.margin_document_blocks
  for update using (auth.uid() = user_id);
