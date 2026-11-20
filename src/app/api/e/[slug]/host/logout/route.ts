import { clearHostSession } from '@/server/adapters/host-session';
import { handle, ok } from '@/server/http';
import { getEventBySlug } from '@/server/services/event-service';

export async function POST(_req: Request, ctx: RouteContext<'/api/e/[slug]/host/logout'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    await clearHostSession((await getEventBySlug(slug)).id);
    return ok({ host: false });
  });
}
