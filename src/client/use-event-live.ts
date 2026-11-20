// Design Ref: §2.2 + FR-09 — read the event over the public key and refetch on every Realtime change.
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Guest, PartyEvent, PlayerState, Track } from '@/domain/types';
import { supabaseBrowser } from './supabase-browser';

/* eslint-disable @typescript-eslint/no-explicit-any */
const toEvent = (r: any): PartyEvent => ({
  id: r.id, slug: r.slug, name: r.name, region: r.region, endMode: r.end_mode,
  liveVideoId: r.live_video_id, liveSource: r.live_source, ytPlaylistId: r.yt_playlist_id, notice: r.notice, createdAt: r.created_at,
});
const toGuest = (r: any): Guest => ({ id: r.id, eventId: r.event_id, name: r.name });
const toTrack = (r: any): Track => ({
  id: r.id, eventId: r.event_id, videoId: r.video_id, title: r.title, channel: r.channel, thumbUrl: r.thumb_url,
  durationSec: r.duration_sec, addedBy: r.added_by, sourceUrl: r.source_url, addedAt: r.added_at,
  firstPlayedAt: r.first_played_at, lastPlayedAt: r.last_played_at, status: r.status, ytItemId: r.yt_item_id,
  syncStatus: r.sync_status,
});
const toPlayer = (r: any): PlayerState => ({
  eventId: r.event_id, currentTrackId: r.current_track_id, mode: r.mode, isPlaying: r.is_playing,
  positionSec: r.position_sec, activePlayerId: r.active_player_id, playSeq: r.play_seq, updatedAt: r.updated_at,
});
/* eslint-enable @typescript-eslint/no-explicit-any */

export type LiveStatus = 'loading' | 'live' | 'reconnecting' | 'not_found' | 'error';

export interface EventLive {
  status: LiveStatus;
  event: PartyEvent | null;
  guests: Guest[];
  tracks: Track[];
  player: PlayerState | null;
  /** Fetch again right away (after this device made a change). */
  refresh: () => void;
}

export function useEventLive(slug: string): EventLive {
  const [state, setState] = useState<Omit<EventLive, 'refresh'>>({
    status: 'loading', event: null, guests: [], tracks: [], player: null,
  });
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    const sb = supabaseBrowser();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let eventId: string | null = null;

    async function load() {
      const ev = await sb.from('events').select().eq('slug', slug).maybeSingle();
      if (cancelled) return;
      if (ev.error) return setState((s) => ({ ...s, status: s.event ? 'reconnecting' : 'error' }));
      if (!ev.data) return setState((s) => ({ ...s, status: 'not_found' }));
      eventId = ev.data.id;
      const [g, t, p] = await Promise.all([
        sb.from('guests').select().eq('event_id', ev.data.id).order('name'),
        sb.from('tracks').select().eq('event_id', ev.data.id).order('added_at'),
        sb.from('player_state').select().eq('event_id', ev.data.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (g.error || t.error || p.error) return setState((s) => ({ ...s, status: 'reconnecting' }));
      setState((s) => ({
        status: s.status === 'reconnecting' && channelDown ? 'reconnecting' : 'live',
        event: toEvent(ev.data),
        guests: (g.data ?? []).map(toGuest),
        tracks: (t.data ?? []).map(toTrack),
        player: p.data ? toPlayer(p.data) : null,
      }));
      if (!subscribed) subscribe(ev.data.id);
    }

    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 120);
    };
    reload.current = soon;

    let subscribed = false;
    let channelDown = false;
    let channel: ReturnType<typeof sb.channel> | null = null;

    function subscribe(id: string) {
      subscribed = true;
      channel = sb
        .channel(`event:${id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tracks', filter: `event_id=eq.${id}` }, soon)
        // DELETE events can't be filtered under RLS, so listen to all deletes and refetch.
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'tracks' }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'player_state', filter: `event_id=eq.${id}` }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'guests', filter: `event_id=eq.${id}` }, soon)
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'guests' }, soon)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'events', filter: `id=eq.${id}` }, soon)
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            const wasDown = channelDown;
            channelDown = false;
            setState((s) => (s.status === 'reconnecting' ? { ...s, status: 'live' } : s));
            if (wasDown) soon(); // catch up on anything missed
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            channelDown = true;
            setState((s) => (s.event ? { ...s, status: 'reconnecting' } : s));
          }
        });
    }

    load();
    // Safety net: refetch every 30 s in case a Realtime message was lost.
    const poll = setInterval(() => eventId && load(), 30_000);
    const onOnline = () => soon();
    window.addEventListener('online', onOnline);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      window.removeEventListener('online', onOnline);
      if (channel) sb.removeChannel(channel);
    };
  }, [slug]);

  const refresh = useCallback(() => reload.current(), []);
  return { ...state, refresh };
}
