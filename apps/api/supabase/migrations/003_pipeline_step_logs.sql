-- Pipeline Step Logs — audit trail for ingest operations
-- Agent-driven operations (cleaning, mapping, harmonization) use AI SDK tool call streaming instead.

create table pipeline_step_logs (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  node_id        text references pipeline_nodes(id) on delete set null,
  source_file_id uuid references source_files(id) on delete set null,
  step_type      text not null,
  status         text not null default 'running' check (status in ('running', 'completed', 'error')),
  input_summary  jsonb,
  output_summary jsonb,
  error_message  text,
  duration_ms    integer,
  created_at     timestamptz not null default now()
);

create index idx_step_logs_node on pipeline_step_logs(node_id);
create index idx_step_logs_source on pipeline_step_logs(source_file_id);
create index idx_step_logs_project on pipeline_step_logs(project_id, created_at desc);

alter table pipeline_step_logs disable row level security;
