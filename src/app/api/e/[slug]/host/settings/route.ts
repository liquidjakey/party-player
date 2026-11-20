// Design Ref: §4.2 PATCH host/settings — end mode, live filler, guests, region (FR-08, FR-11).
import { z } from 'zod';
import { AppError } from '@/domain/errors';
import { db, must } from '@/server/adapters/db';
import { handle, ok, readJson } from '@/server/http';
import { requireHost } from '@/server/require-host';
import { resolveLiveFiller } from '@/server/services/live-service';
import { getPlayerState, advance } from '@/server/services/player-service';

const Body = z.object({
  endMode: z.enum(['loop', 'stop', 'live']).optional(),
  liveUrl: z.string().trim().max(500).optional(),
  clearLive: z.boolean().optional(),
  clearNotice: z.boolean().optional(),
  region: z.string().regex(/^[A-Z]{2}$/).optional(),
  guests: z
    .object({
      add: z.array(z.string().trim().min(1).max(30)).max(50).optional(),
      remove: z.array(z.uuid()).max(50).optional(),
    })
    .optional(),
});

export async function PATCH(req: Request, ctx: RouteContext<'/api/e/[slug]/host/settings'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const body = Body.parse(await readJson(req));
    const event = await requireHost(slug);
    const patch: Record<string, unknown> = {};

    if (body.region) patch.region = body.region;
    if (body.clearNotice) patch.notice = null;
    let liveTitle: string | null = null;
    if (body.liveUrl) {
      const live = await resolveLiveFiller(body.liveUrl, body.region ?? event.region);
      patch.live_video_id = live.liveVideoId;
      patch.live_source = live.liveSource;
      liveTitle = live.title;
    }
    if (body.clearLive) {
      patch.live_video_id = null;
      patch.live_source = null;
      if (event.endMode === 'live' && !body.endMode) patch.end_mode = 'loop';
    }
    if (body.endMode) {
      const hasLive = Boolean(patch.live_video_id ?? (body.clearLive ? null : event.liveVideoId));
      if (body.endMode === 'live' && !hasLive) throw new AppError('NOT_LIVE', undefined, 'Add a live stream link first.');
      patch.end_mode = body.endMode;
      patch.notice = null;
    }
    if (Object.keys(patch).length) must(await db().from('events').update(patch).eq('id', event.id));

    if (body.guests?.add?.length) {
      const names = [...new Set(body.guests.add)];
      must(
        await db()
          .from('guests')
          .upsert(names.map((name) => ({ event_id: event.id, name })), { onConflict: 'event_id,name', ignoreDuplicates: true }),
      );
    }
    for (const guestId of body.guests?.remove ?? []) {
      const { count } = await db().from('tracks').select('id', { count: 'exact', head: true }).eq('added_by', guestId);
      if (count) throw new AppError('GUEST_HAS_SONGS');
      must(await db().from('guests').delete().eq('id', guestId).eq('event_id', event.id));
    }

    // Leaving live mode while the filler plays → move on now.
    const state = await getPlayerState(event.id);
    if (state.mode === 'live' && (body.clearLive || (body.endMode && body.endMode !== 'live'))) {
      const fresh = { ...event, endMode: (body.endMode ?? 'loop') as typeof event.endMode, liveVideoId: null, liveSource: null };
      await advance(fresh);
    }
    return ok({ saved: true, liveTitle });
  });
}
