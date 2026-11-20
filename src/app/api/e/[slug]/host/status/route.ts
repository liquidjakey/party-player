// Design Ref: §4.1 GET host/status — sync counts, Google status, quota, notice. Also tells a page "you are host".
import { handle, ok } from '@/server/http';
import { requireHost } from '@/server/require-host';
import { syncSummary } from '@/server/services/sync-service';

export async function GET(_req: Request, ctx: RouteContext<'/api/e/[slug]/host/status'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const event = await requireHost(slug);
    return ok({ host: true, notice: event.notice, sync: await syncSummary(event.id) });
  });
}
