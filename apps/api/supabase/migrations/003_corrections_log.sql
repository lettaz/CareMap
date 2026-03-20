-- Migration: Add corrections_log table for tracking agent/user changes

create table if not exists corrections_log (
  id              uuid primary key default uuid_generate_v4(),
  project_id      uuid not null references projects(id) on delete cascade,
  action          text not null check (action in ('mapping_change', 'value_fix', 'schema_update', 'field_rename')),
  description     text not null,
  source_file_id  uuid references source_files(id) on delete set null,
  field           text,
  previous_value  text,
  new_value       text,
  applied_by      text not null default 'ai' check (applied_by in ('ai', 'user')),
  created_at      timestamptz not null default now()
);

create index idx_corrections_log_project on corrections_log(project_id);
