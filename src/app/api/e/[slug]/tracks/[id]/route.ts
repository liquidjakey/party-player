// Design Ref: §4.2 DELETE /api/e/[slug]/tracks/[id] — owner, or host cookie (FR-05).
import { after } from 'next/server';
import { z } from 'zod';
import { isHost } from '@/server/adapters/host-session';
import { handle, ok } from '@/server/http';
import { getEventBySlug } from '@/server/services/event-service';
import { syncEvent } from '@/server/services/sync-service';
import { removeTrack } from '@/server/services/track-service';

const Body = z.object({ guestId: z.uuid().nullable().optional() });

export async function DELETE(req: Request, ctx: RouteContext<'/api/e/[slug]/tracks/[id]'>) {
  return handle(async () => {
    const { slug, id } = await ctx.params;
    z.uuid().parse(id);
    const body = Body.parse(await req.json().catch(() => ({})));
    const event = await getEventBySlug(slug);
    await removeTrack(slug, id, body.guestId ?? null, await isHost(event.id));
    after(() => syncEvent(event.id));
    return ok({ removed: id });
  });
}
