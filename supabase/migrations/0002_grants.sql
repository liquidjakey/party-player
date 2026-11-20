-- Newer Supabase projects do not auto-grant table access to the API roles.
-- Server (service_role) gets full access; the public key (anon) can only READ the 4 public tables (RLS still applies).

grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant execute on function add_quota(date, int) to service_role;

grant select on events, guests, tracks, player_state to anon, authenticated;
