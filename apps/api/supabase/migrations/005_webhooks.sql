-- Webhook-based data ingestion
create table webhooks (
  id                uuid primary key default uuid_generate_v4(),
  project_id        uuid not null references projects(id) on delete cascade,
  node_id           text not null,
  name              text not null,
  api_key           text not null unique,
  hmac_secret       text,
  payload_type      text not null default 'both'
                    check (payload_type in ('json', 'file', 'both')),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  last_triggered_at timestamptz,
  trigger_count     int not null default 0
);

create index idx_webhooks_project on webhooks(project_id);
create index idx_webhooks_api_key on webhooks(api_key);
