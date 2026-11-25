// Host reorders the queue. Body: the upcoming song ids, top to bottom (current song left out).
import { z } from 'zod';
import { handle, ok, readJson } from '@/server/http';
import { requireHost } from '@/server/require-host';
import { reorderQueue } from '@/server/services/track-service';

const Body = z.object({ order: z.array(z.uuid()).max(500) });

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/host/reorder'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const { order } = Body.parse(await readJson(req));
    const event = await requireHost(slug);
    await reorderQueue(event.id, order);
    return ok({ order });
  });
}
