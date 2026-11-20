// Design Ref: §4.2 POST /api/e/[slug]/tracks — add a checked YouTube song (FR-03, FR-04).
import { after } from 'next/server';
import { z } from 'zod';
import { handle, ok, readJson } from '@/server/http';
import { syncEvent } from '@/server/services/sync-service';
import { addTrack } from '@/server/services/track-service';

export const maxDuration = 30;

const Body = z
  .object({
    guestId: z.uuid(),
    url: z.string().trim().max(2000).optional(),
    videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/).optional(),
    sourceUrl: z.url().max(2000).optional(),
  })
  .refine((b) => b.url || b.videoId, { message: 'url or videoId required' });

export async function POST(req: Request, ctx: RouteContext<'/api/e/[slug]/tracks'>) {
  return handle(async () => {
    const { slug } = await ctx.params;
    const body = Body.parse(await readJson(req));
    const track = await addTrack(slug, body);
    after(() => syncEvent(track.eventId)); // FR-14 backup mirror, after the response
    return ok(track, 201);
  });
}
