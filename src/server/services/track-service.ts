// Design Ref: §2.2 Add link / Remove flows, §4.2 POST + DELETE tracks.
import 'server-only';
import { AppError } from '@/domain/errors';
import { duplicateMessage } from '@/domain/messages';
import type { Track } from '@/domain/types';
import { forwardTrack, reorderPatches, shuffleOrder, upcomingOrder } from '@/domain/queue-order';
import { checkQueueable } from '@/domain/video-rules';
import { isVideoId, parseYouTubeUrl } from '@/domain/youtube-url';
import { db, must, toTrack } from '../adapters/db';
import { youtube } from '../adapters/youtube-api';
import { getEventBySlug, getGuest } from './event-service';
import { advance, getPlayerState, getTracks, wakeIfIdle } from './player-service';
import { queueDelete } from './sync-service';

export interface AddTrackInput {
  guestId: string;
  url?: string;
  videoId?: string;
  sourceUrl?: string;
}

async function duplicateError(eventId: string, videoId: string): Promise<AppError> {
  const row = must(
    await db().from('tracks').select('added_by, guests(name)').eq('event_id', eventId).eq('video_id', videoId).maybeSingle(),
  ) as { guests: { name: string } | null } | null;
  const name = row?.guests?.name ?? null;
  return new AppError('DUPLICATE', { addedByName: name }, duplicateMessage(name));
}

/** Plan SC: "A fake, private, deleted, non-embeddable, or Korea-blocked link is refused with a plain reason." */
export async function addTrack(slug: string, input: AddTrackInput): Promise<Track> {
  const event = await getEventBySlug(slug);
  const guest = await getGuest(event.id, input.guestId);

  const videoId = input.videoId && isVideoId(input.videoId) ? input.videoId : parseYouTubeUrl(input.url ?? '');
  if (!videoId) throw new AppError('INVALID_LINK');

  const existing = must(
    await db().from('tracks').select('id').eq('event_id', event.id).eq('video_id', videoId).maybeSingle(),
  );
  if (existing) throw await duplicateError(event.id, videoId);

  const video = (await youtube().getVideos([videoId])).get(videoId) ?? null;
  const rule = checkQueueable(video, event.region);
  if (!rule.ok) throw new AppError(rule.code);

  const res = await db()
    .from('tracks')
    .insert({
      event_id: event.id,
      video_id: videoId,
      title: video!.title,
      channel: video!.channel,
      thumb_url: video!.thumbUrl,
      duration_sec: video!.durationSec,
      added_by: guest.id,
      source_url: input.sourceUrl ?? (input.url && !input.url.includes(videoId) ? input.url : null),
    })
    .select()
    .single();
  if (res.error?.code === '23505') throw await duplicateError(event.id, videoId);
  const track = toTrack(must(res));

  await wakeIfIdle(event);
  return track;
}

/** Plan SC: "A guest can remove their own song … the server also refuses." Host may remove any. */
export async function removeTrack(slug: string, trackId: string, guestId: string | null, host: boolean): Promise<void> {
  const event = await getEventBySlug(slug);
  const row = must(await db().from('tracks').select().eq('id', trackId).eq('event_id', event.id).maybeSingle());
  if (!row) throw new AppError('TRACK_NOT_FOUND');
  const track = toTrack(row);
  if (!host && (!guestId || track.addedBy !== guestId)) throw new AppError('NOT_OWNER');

  const state = await getPlayerState(event.id);
  if (state.currentTrackId === track.id) {
    // Removing the playing song would skip it. Skipping is for the TV and the host only
    if (!host) throw new AppError('SONG_PLAYING');
    await advance(event, track.id);
  }

  await queueDelete(event.id, track.ytItemId);
  must(await db().from('tracks').delete().eq('id', track.id));
}

/** Host drags the queue into a new order. `orderedIds` = the upcoming songs, top to bottom. */
export async function reorderQueue(eventId: string, orderedIds: string[]): Promise<void> {
  const [tracks, player] = await Promise.all([getTracks(eventId), getPlayerState(eventId)]);
  const patches = reorderPatches(tracks, player.currentTrackId, orderedIds);
  const results = await Promise.all(
    patches.map((p) =>
      db()
        .from('tracks')
        .update({ position: p.position, ...(p.markUnplayed ? { first_played_at: null } : {}) })
        .eq('id', p.id)
        .eq('event_id', eventId),
    ),
  );
  const failed = results.find((r) => r.error);
  // 42703 / PGRST204 = the position column is missing: migration 0005 was not run yet
  if (failed?.error && ['42703', 'PGRST204'].includes(failed.error.code)) throw new AppError('REORDER_NOT_SET_UP');
  if (failed?.error) throw failed.error;
  // After Previous, the songs stepped back over play first. A new order replaces that: make the current song the newest
  if (forwardTrack(tracks, player.currentTrackId)) {
    must(await db().from('tracks').update({ last_played_at: new Date().toISOString() }).eq('id', player.currentTrackId!));
  }
}

export async function shuffleQueue(eventId: string): Promise<void> {
  const [tracks, player] = await Promise.all([getTracks(eventId), getPlayerState(eventId)]);
  await reorderQueue(eventId, shuffleOrder(upcomingOrder(tracks, player.currentTrackId)));
}
