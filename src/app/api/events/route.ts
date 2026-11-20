// Design Ref: §4.1 POST /api/events — admin creates a reusable event (FR-01).
import { z } from 'zod';
import { clientIp, handle, ok, readJson } from '@/server/http';
import { adminPinRequired } from '@/server/adapters/pin';
import { createEvent } from '@/server/services/event-service';

const Body = z.object({
  adminPin: z.string().max(64).optional(),
  name: z.string().trim().min(1).max(60),
  slug: z.string().regex(/^[a-z0-9-]{2,40}$/),
  guests: z.array(z.string().trim().min(1).max(30)).max(100),
  hostPin: z.string().regex(/^\d{4,6}$/),
  region: z.string().regex(/^[A-Z]{2}$/).default('KR'),
});

/** Lets the new-party page know whether to ask for the admin PIN. */
export async function GET() {
  return ok({ adminPinRequired: adminPinRequired() });
}

export async function POST(req: Request) {
  return handle(async () => {
    const body = Body.parse(await readJson(req));
    const { event, guests } = await createEvent(body, clientIp(req));
    return ok({ slug: event.slug, name: event.name, guests }, 201);
  });
}
