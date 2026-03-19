-- CareMap Initial Schema
-- Canonical clinical tables + pipeline metadata + semantic layer

-- ── Extensions ──
create extension if not exists "uuid-ossp";

-- ── Projects ──

create table projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  description text,
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

-- ── Clinical Tables ──

create table patients (
  id          uuid primary key default uuid_generate_v4(),
  project_id  uuid not null references projects(id) on delete cascade,
  external_id text not null,
  birth_year  int,
  gender      text,
  created_at  timestamptz not null default now()
);

create index idx_patients_project on patients(project_id);
create index idx_patients_external on patients(project_id, external_id);

create table encounters (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  patient_id uuid not null references patients(id) on delete cascade,
  type       text not null,
  ward       text,
  start_date date,
  end_date   date
);

create index idx_encounters_project on encounters(project_id);
create index idx_encounters_patient on encounters(patient_id);

create table diagnoses (
  id           uuid primary key default uuid_generate_v4(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  code         text not null,
  code_system  text,
  description  text,
  date         date
);

create index idx_diagnoses_encounter on diagnoses(encounter_id);

create table lab_results (
  id              uuid primary key default uuid_generate_v4(),
  encounter_id    uuid not null references encounters(id) on delete cascade,
  test_code       text,
  test_name       text not null,
  value           numeric not null,
  unit            text not null,
  reference_range text,
  measured_at     timestamptz not null
);

create index idx_lab_results_encounter on lab_results(encounter_id);

create table vital_signs (
  id           uuid primary key default uuid_generate_v4(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  type         text not null,
  value        numeric not null,
  unit         text not null,
  measured_at  timestamptz not null
);

create index idx_vital_signs_encounter on vital_signs(encounter_id);

create table medications (
  id           uuid primary key default uuid_generate_v4(),
  encounter_id uuid not null references encounters(id) on delete cascade,
  drug_name    text not null,
  drug_code    text,
  dose         numeric,
  unit         text,
  frequency    text,
  start_date   date,
  end_date     date
);

create index idx_medications_encounter on medications(encounter_id);

create table care_assessments (
  id              uuid primary key default uuid_generate_v4(),
  encounter_id    uuid not null references encounters(id) on delete cascade,
  patient_id      uuid not null references patients(id) on delete cascade,
  assessment_type text not null,
  score           numeric not null,
  scale_min       numeric,
  scale_max       numeric,
  assessed_at     timestamptz not null,
  assessor        text
);

create index idx_care_assessments_encounter on care_assessments(encounter_id);
create index idx_care_assessments_patient on care_assessments(patient_id);
create index idx_care_assessments_type on care_assessments(assessment_type);

create table care_interventions (
  id                uuid primary key default uuid_generate_v4(),
  encounter_id      uuid not null references encounters(id) on delete cascade,
  intervention_type text not null,
  description       text,
  start_date        date,
  end_date          date,
  status            text not null default 'planned'
);

create index idx_care_interventions_encounter on care_interventions(encounter_id);

create table sensor_readings (
  id          uuid primary key default uuid_generate_v4(),
  patient_id  uuid not null references patients(id) on delete cascade,
  sensor_type text not null,
  value       numeric not null,
  unit        text not null,
  measured_at timestamptz not null
);

create index idx_sensor_readings_patient on sensor_readings(patient_id);

create table staff_schedules (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  staff_id   text not null,
  ward       text not null,
  role       text not null,
  shift_start timestamptz not null,
  shift_end   timestamptz not null
);

create index idx_staff_schedules_project on staff_schedules(project_id);

-- ── Pipeline State Tables ──

create table source_files (
  id           uuid primary key default uuid_generate_v4(),
  project_id   uuid not null references projects(id) on delete cascade,
  filename     text not null,
  file_type    text not null,
  uploaded_at  timestamptz not null default now(),
  row_count    int,
  column_count int,
  raw_profile  jsonb,
  storage_path text
);

create index idx_source_files_project on source_files(project_id);

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

create table pipeline_nodes (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  node_type  text not null,
  label      text not null,
  config     jsonb,
  position   jsonb not null default '{"x": 0, "y": 0}',
  status     text not null default 'idle'
);

create index idx_pipeline_nodes_project on pipeline_nodes(project_id);

create table pipeline_edges (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  source_node_id uuid not null references pipeline_nodes(id) on delete cascade,
  target_node_id uuid not null references pipeline_nodes(id) on delete cascade
);

create index idx_pipeline_edges_project on pipeline_edges(project_id);

-- ── Semantic Layer ──

create table semantic_entities (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid not null references projects(id) on delete cascade,
  entity_name    text not null,
  description    text,
  sql_table_name text not null,
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
  sql_expression text not null,
  data_type      text not null,
  description    text
);

create index idx_semantic_fields_entity on semantic_fields(entity_id);

create table semantic_joins (
  id             uuid primary key default uuid_generate_v4(),
  from_entity_id uuid not null references semantic_entities(id) on delete cascade,
  to_entity_id   uuid not null references semantic_entities(id) on delete cascade,
  join_sql       text not null
);

-- ── Dashboard ──

create table pinned_widgets (
  id         uuid primary key default uuid_generate_v4(),
  project_id uuid not null references projects(id) on delete cascade,
  title      text not null,
  query_text text not null,
  sql_query  text not null,
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

-- ── Row Level Security (disabled for prototype, enable in production) ──

-- alter table projects enable row level security;
-- alter table patients enable row level security;
-- ... etc.
