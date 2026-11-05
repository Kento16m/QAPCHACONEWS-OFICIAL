-- A row here means the public site already uses this project, so the production copy must never run again.
create table private.cutover (
  done_at timestamptz not null
);

alter table private.cutover enable row level security;
revoke all on private.cutover from public, anon, authenticated;
