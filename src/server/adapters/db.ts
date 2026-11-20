// Design Ref: §9.4 — the only place that talks to Supabase with the service key. Maps snake_case ↔ camelCase.
import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Guest, PartyEvent, PlayerState, Track } from '@/domain/types';

let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export const toEvent = (r: any): PartyEvent => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  region: r.region,
  endMode: r.end_mode,
  liveVideoId: r.live_video_id,
  liveSource: r.live_source,
  ytPlaylistId: r.yt_playlist_id,
  notice: r.notice,
  createdAt: r.created_at,
});

export const toGuest = (r: any): Guest => ({ id: r.id, eventId: r.event_id, name: r.name });

export const toTrack = (r: any): Track => ({
  id: r.id,
  eventId: r.event_id,
  videoId: r.video_id,
  title: r.title,
  channel: r.channel,
  thumbUrl: r.thumb_url,
  durationSec: r.duration_sec,
  addedBy: r.added_by,
  sourceUrl: r.source_url,
  addedAt: r.added_at,
  firstPlayedAt: r.first_played_at,
  lastPlayedAt: r.last_played_at,
  status: r.status,
  ytItemId: r.yt_item_id,
  syncStatus: r.sync_status,
});

export const toPlayer = (r: any): PlayerState => ({
  eventId: r.event_id,
  currentTrackId: r.current_track_id,
  mode: r.mode,
  isPlaying: r.is_playing,
  positionSec: r.position_sec,
  activePlayerId: r.active_player_id,
  playSeq: r.play_seq,
  updatedAt: r.updated_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Throw on a Supabase error so services stay short. */
export function must<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) {
    const err = new Error(res.error.message) as Error & { pgCode?: string };
    err.pgCode = res.error.code;
    throw err;
  }
  return res.data;
}
