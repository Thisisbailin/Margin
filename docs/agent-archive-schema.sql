-- Agent Archive schema (Supabase)
-- Tables:
-- 1) agent_archives: structured research projects
-- 2) agent_archive_entries: research logs / incremental notes

create table if not exists public.agent_archives (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id text not null,
  project_id text,
  book_id text,
  title text not null,
  topic text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  summary text,
  outline jsonb,
  tags text[],
  metadata jsonb
);

create index if not exists agent_archives_user_id_idx on public.agent_archives (user_id);
create index if not exists agent_archives_project_id_idx on public.agent_archives (project_id);
create index if not exists agent_archives_book_id_idx on public.agent_archives (book_id);
create index if not exists agent_archives_updated_at_idx on public.agent_archives (updated_at desc);
create index if not exists agent_archives_tags_gin on public.agent_archives using gin (tags);

create table if not exists public.agent_archive_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  archive_id uuid not null references public.agent_archives (id) on delete cascade,
  entry_type text not null default 'note',
  title text,
  content text,
  tags text[],
  metadata jsonb,
  role text
);

create index if not exists agent_archive_entries_archive_id_idx on public.agent_archive_entries (archive_id);
create index if not exists agent_archive_entries_created_at_idx on public.agent_archive_entries (created_at desc);
create index if not exists agent_archive_entries_tags_gin on public.agent_archive_entries using gin (tags);

-- Optional: enable RLS if you want client-side read access later
-- alter table public.agent_archives enable row level security;
-- alter table public.agent_archive_entries enable row level security;
