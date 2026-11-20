// Design Ref: §4.1 POST host/sync — "N songs not synced" → Retry.
import { handle, ok } from '@/server/http';
import { requireHost } from '@/server/require-host';
import { retrySync, syncSummary } from '@/server/services/sync-service';

export const maxDuration = 60;

export async function POST(_req: Request, ctx: RouteContext<'/api/e/[slug]/host/sync'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const event = await requireHost(slug);
    await retrySync(event.id);
    return ok(await syncSummary(event.id));
  });
}
