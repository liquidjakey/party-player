// Design Ref: §4.2 POST /api/e/[slug]/player — the TV reports; the server decides (FR-07).
import { z } from 'zod';
import { AppError } from '@/domain/errors';
import { handle, ok, readJson } from '@/server/http';
import { getEventBySlug } from '@/server/services/event-service';
import { advance, claimPlayer, getPlayerState, liveEnded, markBroken, setPosition } from '@/server/services/player-service';

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim'), playerId: z.string().min(8).max(64) }),
  z.object({ action: z.literal('ended'), playerId: z.string().min(8).max(64), trackId: z.uuid().nullable(), playSeq: z.number().int() }),
  z.object({
    action: z.literal('error'),
    playerId: z.string().min(8).max(64),
    trackId: z.uuid().nullable(),
    playSeq: z.number().int(),
    errorCode: z.number().int(),
  }),
  z.object({ action: z.literal('position'), playerId: z.string().min(8).max(64), positionSec: z.number().min(0).max(86_400) }),
]);

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/player'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const body = Body.parse(await readJson(req));
    const event = await getEventBySlug(slug);

    if (body.action === 'claim') return ok(await claimPlayer(event.id, body.playerId));

    const state = await getPlayerState(event.id);
    if (state.activePlayerId !== body.playerId) throw new AppError('NOT_ACTIVE_PLAYER');

    if (body.action === 'position') {
      if (state.mode === 'song') await setPosition(event.id, body.positionSec);
      return ok({ saved: true });
    }
    // Ignore stale reports (something else already started).
    if (body.playSeq !== state.playSeq) return ok(await getPlayerState(event.id));

    if (body.action === 'ended') {
      await advance(event);
    } else if (state.mode === 'live') {
      await liveEnded(event); // live filler broke → Loop + host notice
      await advance({ ...event, endMode: 'loop' });
    } else if (body.trackId && [2, 5, 100, 101, 150].includes(body.errorCode)) {
      await markBroken(event, body.trackId);
    } else {
      await advance(event);
    }
    return ok(await getPlayerState(event.id));
  });
}
