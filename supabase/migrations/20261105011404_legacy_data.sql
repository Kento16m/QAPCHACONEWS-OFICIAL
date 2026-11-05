-- Rows from the old database with no place in the new tables, kept so nothing is lost.
-- Outside the API schema and with no grants: only the project owner can read it, from SQL.
create table private.legacy_data (
  id bigint generated always as identity primary key,
  source_table text not null,
  source_id text,
  reason text not null,
  "row" jsonb not null,
  imported_at timestamptz not null default now()
);

create index legacy_data_source_idx on private.legacy_data (source_table, source_id);

alter table private.legacy_data enable row level security;
revoke all on private.legacy_data from public, anon, authenticated;
