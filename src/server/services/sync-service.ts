// Design Ref: §2.2 "after(): playlist-sync" + FR-14 — mirror the queue into the host's real YouTube playlist.
// Plan SC: "Every added/removed song is mirrored … within ~1 minute (or flagged as not synced)."
import 'server-only';
import type { PartyEvent } from '@/domain/types';
import { db, must, toEvent, toTrack } from '../adapters/db';
import { accessToken, GoogleExpiredError, googleStatus, type GoogleStatus } from '../adapters/google-oauth';
import { COST, quotaUsedToday, spendQuota } from '../adapters/quota';

const API = 'https://www.googleapis.com/youtube/v3';

class PlaylistGoneError extends Error {}

async function yt(method: string, path: string, body?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/${path}`, {
    method,
    headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 204) return {};
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    error?: { errors?: { reason?: string }[] };
  };
  if (!res.ok) {
    const reason = json.error?.errors?.[0]?.reason ?? String(res.status);
    if (reason === 'playlistNotFound') throw new PlaylistGoneError();
    if (res.status === 404 && method === 'DELETE') return {}; // already gone
    throw new Error(`YouTube ${method} ${path.split('?')[0]} failed: ${reason}`);
  }
  return json;
}

async function ensurePlaylist(event: PartyEvent): Promise<string | null> {
  if (event.ytPlaylistId) return event.ytPlaylistId;
  if (!(await spendQuota(COST.playlistInsert))) return null;
  const created = await yt('POST', 'playlists?part=snippet,status', {
    snippet: { title: `Party: ${event.name}`, description: `Backup of the ${event.name} party playlist.` },
    status: { privacyStatus: 'unlisted' },
  });
  const id = created.id as string;
  must(await db().from('events').update({ yt_playlist_id: id }).eq('id', event.id));
  return id;
}

/** Copy every not-yet-synced song (in added order) and finish pending deletes. Safe to call often. */
export async function syncEvent(eventId: string): Promise<void> {
  if (process.env.YOUTUBE_FAKE === '1') return;
  if ((await googleStatus()) !== 'ok') return;
  const evRow = must(await db().from('events').select().eq('id', eventId).single());
  const event = toEvent(evRow);
  try {
    const playlistId = await ensurePlaylist(event);
    if (!playlistId) return;

    const dels = must(await db().from('pending_deletes').select('yt_item_id').eq('event_id', eventId)) ?? [];
    for (const d of dels) {
      if (!(await spendQuota(COST.playlistDelete))) return;
      await yt('DELETE', `playlistItems?id=${encodeURIComponent(d.yt_item_id)}`);
      await db().from('pending_deletes').delete().eq('yt_item_id', d.yt_item_id);
    }

    const rows =
      must(
        await db()
          .from('tracks')
          .select()
          .eq('event_id', eventId)
          .in('sync_status', ['pending', 'failed'])
          .order('added_at'),
      ) ?? [];
    for (const track of rows.map(toTrack)) {
      // Claim the row first so two servers syncing at once never add the same song twice.
      const claimed = await db()
        .from('tracks')
        .update({ sync_status: 'syncing' })
        .eq('id', track.id)
        .in('sync_status', ['pending', 'failed'])
        .select('id');
      if (!claimed.data?.length) continue;
      if (!(await spendQuota(COST.playlistInsert))) {
        await db().from('tracks').update({ sync_status: track.syncStatus }).eq('id', track.id);
        return;
      }
      try {
        const item = await yt('POST', 'playlistItems?part=snippet', {
          snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId: track.videoId } },
        });
        await db().from('tracks').update({ yt_item_id: item.id as string, sync_status: 'synced' }).eq('id', track.id);
      } catch (err) {
        await db().from('tracks').update({ sync_status: 'failed' }).eq('id', track.id);
        if (err instanceof PlaylistGoneError || err instanceof GoogleExpiredError) throw err;
      }
    }
  } catch (err) {
    if (err instanceof PlaylistGoneError) {
      // The host deleted the backup playlist: make a new one next time and copy everything again.
      await db().from('events').update({ yt_playlist_id: null }).eq('id', eventId);
      await db().from('tracks').update({ sync_status: 'pending', yt_item_id: null }).eq('event_id', eventId);
      await db().from('pending_deletes').delete().eq('event_id', eventId);
      return;
    }
    if (err instanceof GoogleExpiredError) return; // host page shows "Reconnect YouTube"
    console.error('[party-playlist] sync failed', err);
  }
}

/** Remember a backup item to delete (called before the track row is removed). */
export async function queueDelete(eventId: string, ytItemId: string | null): Promise<void> {
  if (!ytItemId) return;
  await db().from('pending_deletes').upsert({ yt_item_id: ytItemId, event_id: eventId });
}

export interface SyncSummary {
  google: GoogleStatus;
  playlistUrl: string | null;
  synced: number;
  waiting: number;
  failed: number;
  pendingDeletes: number;
  quotaUsed: number;
}

export async function syncSummary(eventId: string): Promise<SyncSummary> {
  const [google, ev, tracks, dels, quotaUsed] = await Promise.all([
    googleStatus(),
    db().from('events').select('yt_playlist_id').eq('id', eventId).single(),
    db().from('tracks').select('sync_status').eq('event_id', eventId),
    db().from('pending_deletes').select('yt_item_id', { count: 'exact', head: true }).eq('event_id', eventId),
    quotaUsedToday(),
  ]);
  const list = (tracks.data ?? []) as { sync_status: string }[];
  const count = (s: string) => list.filter((t) => t.sync_status === s).length;
  const pid = ev.data?.yt_playlist_id as string | null;
  return {
    google,
    playlistUrl: pid ? `https://www.youtube.com/playlist?list=${pid}` : null,
    synced: count('synced'),
    waiting: count('pending') + count('syncing'),
    failed: count('failed'),
    pendingDeletes: dels.count ?? 0,
    quotaUsed,
  };
}

/** Host "Retry": un-stick rows left in 'syncing' by a crashed run, then sync. */
export async function retrySync(eventId: string): Promise<void> {
  await db().from('tracks').update({ sync_status: 'failed' }).eq('event_id', eventId).eq('sync_status', 'syncing');
  await syncEvent(eventId);
}
