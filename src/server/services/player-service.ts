// Design Ref: §1.2 "Server decides, TV follows" + §4.3 — the only writer of player_state.
import 'server-only';
import { nextTrack, previousTrack } from '@/domain/queue-order';
import type { PartyEvent, PlayerState, Track } from '@/domain/types';
import { db, must, toPlayer, toTrack } from '../adapters/db';
import { refreshLiveFiller } from './live-service';

export async function getPlayerState(eventId: string): Promise<PlayerState> {
  const row = must(await db().from('player_state').select().eq('event_id', eventId).single());
  return toPlayer(row);
}

export async function getTracks(eventId: string): Promise<Track[]> {
  const rows = must(await db().from('tracks').select().eq('event_id', eventId).order('added_at'));
  return (rows ?? []).map(toTrack);
}

/** `bump` = a new thing starts playing (TV reloads the player even if it is the same song). */
async function setState(eventId: string, patch: Record<string, unknown>, bump = false): Promise<void> {
  if (bump) patch = { ...patch, play_seq: (await getPlayerState(eventId)).playSeq + 1 };
  must(
    await db()
      .from('player_state')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('event_id', eventId),
  );
}

/** Make `track` the current song and mark it played. */
export async function startTrack(eventId: string, track: Track): Promise<void> {
  const now = new Date().toISOString();
  must(
    await db()
      .from('tracks')
      .update({ first_played_at: track.firstPlayedAt ?? now, last_played_at: now })
      .eq('id', track.id),
  );
  await setState(eventId, { current_track_id: track.id, mode: 'song', is_playing: true, position_sec: 0 }, true);
}

/**
 * Move to whatever plays next. `removingId` is excluded (used when the playing song is removed).
 * Plan SC: "After one Start party press, the TV plays the whole queue … following the selected end mode."
 */
export async function advance(event: PartyEvent, removingId?: string): Promise<void> {
  const state = await getPlayerState(event.id);
  const tracks = (await getTracks(event.id)).filter((t) => t.id !== removingId);
  const next = nextTrack(tracks, state.currentTrackId, event.endMode, event.liveVideoId);

  if (next.mode === 'song') {
    await startTrack(event.id, tracks.find((t) => t.id === next.trackId)!);
  } else if (next.mode === 'live') {
    const liveId = await refreshLiveFiller(event);
    if (!liveId) {
      // Plan failure map: "Live stream goes offline → switches to Loop; host page notice".
      await liveEnded(event);
      return advance({ ...event, endMode: 'loop', liveVideoId: null, liveSource: null }, removingId);
    }
    if (liveId !== event.liveVideoId) {
      must(await db().from('events').update({ live_video_id: liveId }).eq('id', event.id));
    }
    await setState(event.id, { current_track_id: null, mode: 'live', is_playing: true, position_sec: 0 }, true);
  } else {
    await setState(event.id, { current_track_id: null, mode: next.mode, is_playing: false, position_sec: 0 }, true);
  }
}

/**
 * FR-08 wake-up rule: when play stopped or the live filler is on, a new song starts right away
 * (normal order, so older never-played songs still go first).
 * 'idle' (party not started, or queue was empty) is left alone: the TV starts it, so songs added
 * days before the party wait in the queue instead of being marked as played.
 */
export async function wakeIfIdle(event: PartyEvent): Promise<void> {
  const state = await getPlayerState(event.id);
  if (state.mode === 'stopped' || state.mode === 'live') {
    await advance(event);
  }
}

export async function liveEnded(event: PartyEvent): Promise<void> {
  must(await db().from('events').update({ end_mode: 'loop', notice: 'live_ended' }).eq('id', event.id));
}

/** TV tab claims the player; the newest tab wins (Plan failure map: two TV pages). */
export async function claimPlayer(eventId: string, playerId: string): Promise<PlayerState> {
  await setState(eventId, { active_player_id: playerId });
  return getPlayerState(eventId);
}

export async function setPlaying(eventId: string, isPlaying: boolean): Promise<void> {
  await setState(eventId, { is_playing: isPlaying });
}

export async function setPosition(eventId: string, positionSec: number): Promise<void> {
  must(
    await db()
      .from('player_state')
      .update({ position_sec: Math.max(0, Math.round(positionSec)) })
      .eq('event_id', eventId),
  );
}

/** Back: the previous played song; nothing earlier → restart the current one. */
export async function back(event: PartyEvent): Promise<void> {
  const state = await getPlayerState(event.id);
  const tracks = await getTracks(event.id);
  const prevId = previousTrack(tracks, state.currentTrackId);
  const prev = prevId ? tracks.find((t) => t.id === prevId) : undefined;
  if (prev) await startTrack(event.id, prev);
  else await advance(event);
}

/** Mark a song that YouTube refused to play (errors 100/101/150) and move on. */
export async function markBroken(event: PartyEvent, trackId: string): Promise<void> {
  must(await db().from('tracks').update({ status: 'broken' }).eq('id', trackId).eq('event_id', event.id));
  await advance(event);
}
