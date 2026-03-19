-- CareMap Initial Schema
-- Metadata tables only — clinical data lives as Parquet files in Supabase Storage

-- ── Extensions ──
create extension if not exists "uuid-ossp";

-- ── Projects ──

create table projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
  settings    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();

-- ── Source Files (references to Supabase Storage) ──

create table source_files (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  filename     text not null,
  file_type    text not null,
  uploaded_at  timestamptz not null default now(),
  row_count    int,
  column_count int,
  raw_profile  jsonb,
  storage_path text,
  cleaned_path text,
  status       text not null default 'raw' check (status in ('raw', 'profiling', 'profiled', 'cleaning', 'clean', 'error'))
);

create index idx_source_files_project on source_files(project_id);

-- ── Source Profiles (column-level metadata) ──

create table source_profiles (
  id              uuid primary key default uuid_generate_v4(),
  source_file_id  uuid not null references source_files(id) on delete cascade,
  column_name     text not null,
  inferred_type   text not null,
  semantic_label  text,
  domain          text,
  confidence      numeric not null default 0,
  sample_values   jsonb not null default '[]',
  quality_flags   jsonb not null default '[]',
  user_corrected  boolean not null default false
);

create index idx_source_profiles_file on source_profiles(source_file_id);

-- ── Field Mappings ──

create table field_mappings (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  source_file_id  uuid not null references source_files(id) on delete cascade,
  source_column   text not null,
  target_table    text not null,
  target_column   text not null,
  transformation  text,
  confidence      numeric not null default 0,
  reasoning       text,
  status          text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  reviewed_by     text,
  reviewed_at     timestamptz
);

create index idx_field_mappings_project on field_mappings(project_id);
create index idx_field_mappings_source on field_mappings(source_file_id);
create index idx_field_mappings_status on field_mappings(project_id, status);

-- ── Pipeline State ──

create table pipeline_nodes (
  id         text primary key,
  project_id uuid not null references projects(id) on delete cascade,
  node_type  text not null,
  label      text not null,
  config     jsonb,
  position   jsonb not null default '{"x": 0, "y": 0}',
  status     text not null default 'idle'
);

create index idx_pipeline_nodes_project on pipeline_nodes(project_id);

create table pipeline_edges (
  id             text primary key,
  project_id     uuid not null references projects(id) on delete cascade,
  source_node_id text not null references pipeline_nodes(id) on delete cascade,
  target_node_id text not null references pipeline_nodes(id) on delete cascade
);

create index idx_pipeline_edges_project on pipeline_edges(project_id);

-- ── Semantic Layer (describes what Parquet files exist and their schema) ──

create table semantic_entities (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  entity_name    text not null,
  description    text,
  parquet_path   text not null,
  row_count      int,
  created_from   jsonb not null default '[]',
  updated_at     timestamptz not null default now()
);

create trigger semantic_entities_updated_at
  before update on semantic_entities
  for each row execute function update_updated_at();

create index idx_semantic_entities_project on semantic_entities(project_id);

create table semantic_fields (
  id             uuid primary key default uuid_generate_v4(),
  entity_id      uuid not null references semantic_entities(id) on delete cascade,
  field_name     text not null,
  data_type      text not null,
  description    text
);

create index idx_semantic_fields_entity on semantic_fields(entity_id);

create table semantic_joins (
  id             uuid primary key default uuid_generate_v4(),
  from_entity_id uuid not null references semantic_entities(id) on delete cascade,
  to_entity_id   uuid not null references semantic_entities(id) on delete cascade,
  join_column    text not null
);

-- ── Dashboard ──

create table pinned_widgets (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title      text not null,
  query_text text not null,
  query_code text not null,
  chart_spec jsonb not null,
  pinned_at  timestamptz not null default now()
);

create index idx_pinned_widgets_project on pinned_widgets(project_id);

create table quality_alerts (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references projects(id) on delete cascade,
  severity         text not null check (severity in ('critical', 'warning', 'info')),
  summary          text not null,
  source_file_id   uuid references source_files(id) on delete set null,
  affected_count   int not null default 0,
  detection_method text,
  acknowledged     boolean not null default false,
  created_at       timestamptz not null default now()
);

create index idx_quality_alerts_project on quality_alerts(project_id);
create index idx_quality_alerts_severity on quality_alerts(project_id, severity);

-- ── Conversations ──

create table conversations (
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

create table conversation_messages (
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
