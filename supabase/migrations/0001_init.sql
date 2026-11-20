-- Design Ref: §3.3 — schema + Row Level Security (public key = read-only on 4 tables).
-- Run once in Supabase: Dashboard → SQL Editor → paste → Run.

create extension if not exists pgcrypto;

create table events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null check (char_length(name) between 1 and 60),
  region text not null default 'KR' check (region ~ '^[A-Z]{2}$'),
  end_mode text not null default 'loop' check (end_mode in ('loop','stop','live')),
  live_video_id text,
  live_source text,             -- channel live page (…/@handle/live) to re-find the current stream
  yt_playlist_id text,
  notice text,
  created_at timestamptz not null default now()
);

create table event_secrets (
  event_id uuid primary key references events on delete cascade,
  host_pin_hash text not null
);

create table guests (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  unique (event_id, name)
);

create table tracks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events on delete cascade,
  video_id text not null check (video_id ~ '^[A-Za-z0-9_-]{11}$'),
  title text not null,
  channel text not null,
  thumb_url text not null,
  duration_sec int not null default 0,
  added_by uuid references guests on delete set null,
  source_url text,
  added_at timestamptz not null default now(),
  first_played_at timestamptz,
  last_played_at timestamptz,
  status text not null default 'ok' check (status in ('ok','broken')),
  yt_item_id text,
  sync_status text not null default 'pending'
    check (sync_status in ('pending','syncing','synced','failed','skipped')),
  unique (event_id, video_id)
);
create index tracks_event_order on tracks (event_id, added_at);

create table player_state (
  event_id uuid primary key references events on delete cascade,
  current_track_id uuid references tracks on delete set null,
  mode text not null default 'idle' check (mode in ('song','live','stopped','idle')),
  is_playing boolean not null default false,
  position_sec int not null default 0,
  active_player_id text,
  play_seq int not null default 0,   -- +1 each time something new starts (TV reloads)
  updated_at timestamptz not null default now()
);

create table google_auth (
  id int primary key default 1 check (id = 1),
  refresh_token_enc text not null,
  status text not null default 'ok' check (status in ('ok','expired')),
  updated_at timestamptz not null default now()
);

create table pending_deletes (    -- backup playlist items still to delete (retry)
  yt_item_id text primary key,
  event_id uuid not null references events on delete cascade,
  created_at timestamptz not null default now()
);

create table resolve_cache (
  key text primary key,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table quota_usage (
  day date primary key,
  units int not null default 0
);

create table pin_attempts (
  scope text not null,          -- event id, or 'admin'
  ip text not null,
  fails int not null default 0,
  locked_until timestamptz,
  primary key (scope, ip)
);

-- Atomic quota counter (called by the server with the service key).
create or replace function add_quota(p_day date, p_units int) returns int
language sql as $$
  insert into quota_usage (day, units) values (p_day, p_units)
  on conflict (day) do update set units = quota_usage.units + excluded.units
  returning units;
$$;

-- Row Level Security
alter table events        enable row level security;
alter table guests        enable row level security;
alter table tracks        enable row level security;
alter table player_state  enable row level security;
alter table event_secrets enable row level security;
alter table google_auth   enable row level security;
alter table resolve_cache enable row level security;
alter table quota_usage   enable row level security;
alter table pin_attempts  enable row level security;
alter table pending_deletes enable row level security;

create policy read_events  on events       for select to anon, authenticated using (true);
create policy read_guests  on guests       for select to anon, authenticated using (true);
create policy read_tracks  on tracks       for select to anon, authenticated using (true);
create policy read_player  on player_state for select to anon, authenticated using (true);
-- No policies on the other tables: only the service key (server) can touch them.

revoke execute on function add_quota(date, int) from anon, authenticated;

-- Live updates
alter publication supabase_realtime add table events, guests, tracks, player_state;
-- Newer Supabase projects do not auto-grant table access to the API roles.
-- Server (service_role) gets full access; the public key (anon) can only READ the 4 public tables (RLS still applies).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant execute on function add_quota(date, int) to service_role;

grant select on events, guests, tracks, player_state to anon, authenticated;
