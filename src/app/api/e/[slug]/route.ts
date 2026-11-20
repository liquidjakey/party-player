// Design Ref: §4.1 GET /api/e/[slug] — public event info + guest list.
import { handle, ok } from '@/server/http';
import { getEventBySlug, getGuests } from '@/server/services/event-service';

export async function GET(_req: Request, ctx: RouteContext<'/api/e/[slug]'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const event = await getEventBySlug(slug);
    const guests = await getGuests(event.id);
    return ok({ event, guests });
  });
}
