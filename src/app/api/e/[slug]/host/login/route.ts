// Design Ref: §4.1 host login — PIN → httpOnly cookie (FR-11).
import { z } from 'zod';
import { db, must } from '@/server/adapters/db';
import { setHostSession } from '@/server/adapters/host-session';
import { verifyEventPin } from '@/server/adapters/pin';
import { clientIp, handle, ok, readJson } from '@/server/http';
import { getEventBySlug } from '@/server/services/event-service';

const Body = z.object({ pin: z.string().regex(/^\d{4,6}$/) });

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/host/login'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const { pin } = Body.parse(await readJson(req));
    const event = await getEventBySlug(slug);
    const secret = must(await db().from('event_secrets').select('host_pin_hash').eq('event_id', event.id).single());
    await verifyEventPin(event.id, clientIp(req), pin, secret!.host_pin_hash);
    await setHostSession(event.id);
    return ok({ host: true });
  });
}
