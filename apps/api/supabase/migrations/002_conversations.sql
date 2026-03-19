-- Migration: Add conversations, messages, and project settings
-- Part of CareMap backend Phase 6

-- Conversations table
create table if not exists conversations (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  title       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger conversations_updated_at
  before update on conversations
  for each row execute function update_updated_at();

create index idx_conversations_project on conversations(project_id);

-- Conversation messages table
create table if not exists conversation_messages (
  id              uuid primary key default uuid_generate_v4(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content         text,
  tool_calls      jsonb,
  tool_results    jsonb,
  artifacts       jsonb,
  created_at      timestamptz not null default now()
);

create index idx_conv_messages_conv on conversation_messages(conversation_id);

-- Add settings JSONB to projects (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'projects' and column_name = 'settings'
  ) then
    alter table projects add column settings jsonb not null default '{}';
  end if;
end $$;

-- Add status and cleaned_path to source_files (idempotent)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'source_files' and column_name = 'status'
  ) then
    alter table source_files add column status text not null default 'raw';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'source_files' and column_name = 'cleaned_path'
  ) then
    alter table source_files add column cleaned_path text;
  end if;
end $$;
