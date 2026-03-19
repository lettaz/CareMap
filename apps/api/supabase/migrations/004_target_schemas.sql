-- Dynamic target schemas — per-project, AI-proposed or user-defined

create table target_schemas (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  version     int not null default 1,
  status      text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  tables      jsonb not null default '[]',
  proposed_by text not null default 'ai',
  created_at  timestamptz not null default now()
);

create index idx_target_schemas_project on target_schemas(project_id);
create index idx_target_schemas_active on target_schemas(project_id, status) where status = 'active';

alter table target_schemas disable row level security;
