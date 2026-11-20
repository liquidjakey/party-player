-- Open site (2026-11-20): anyone can host, so the YouTube backup login is stored per party, not once per site.
create table event_google_auth (
  event_id uuid primary key references events on delete cascade,
  refresh_token_enc text not null,
  status text not null default 'ok' check (status in ('ok','expired')),
  updated_at timestamptz not null default now()
);
alter table event_google_auth enable row level security; -- no policies: server only
grant all on event_google_auth to service_role;

-- The old single-account table is no longer used.
drop table if exists google_auth;
