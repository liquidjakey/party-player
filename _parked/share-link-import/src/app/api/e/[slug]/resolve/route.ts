// Design Ref: §4.2 POST /api/e/[slug]/resolve — FR-12/FR-13.
import { z } from 'zod';
import { handle, ok, readJson } from '@/server/http';
import { resolveForGuest } from '@/server/services/resolve-service';

const Body = z
  .object({ guestId: z.uuid(), url: z.string().trim().max(2000).optional(), query: z.string().trim().min(2).max(200).optional() })
  .refine((b) => b.url || b.query, { message: 'url or query required' });

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/resolve'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    return ok(await resolveForGuest(slug, Body.parse(await readJson(req))));
  });
}
