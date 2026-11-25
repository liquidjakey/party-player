// Design Ref: §4.2 host/control — FR-10. Plan SC: "The host taps Pause / Skip / Back … the TV reacts within ~1 second."
import { z } from 'zod';
import { handle, ok, readJson } from '@/server/http';
import { requireHost } from '@/server/require-host';
import { control, CONTROL_ACTIONS } from '@/server/services/control-service';
import { getPlayerState } from '@/server/services/player-service';

const Body = z.object({ action: z.enum(CONTROL_ACTIONS) });

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/host/control'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const { action } = Body.parse(await readJson(req));
    const event = await requireHost(slug);
    await control(event, action);
    return ok(await getPlayerState(event.id));
  });
}
