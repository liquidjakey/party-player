// Design Ref: §4.1 GET /api/google/callback — signed state, store refresh token, start the backup sync.
import { after, connection } from 'next/server';
import { saveFromCode } from '@/server/adapters/google-oauth';
import { unsign } from '@/server/adapters/host-session';
import { getEventBySlug } from '@/server/services/event-service';
import { syncEvent } from '@/server/services/sync-service';

export const maxDuration = 60;

export async function GET(req: Request) {
  await connection(); // always run per request (never prerender)
  const url = new URL(req.url);
  const state = unsign<{ slug: string; exp: number }>(url.searchParams.get('state') ?? undefined);
  const base = process.env.APP_URL?.replace(/\/$/, '') ?? url.origin;
  if (!state || state.exp < Date.now()) return Response.redirect(`${base}/?google=bad_state`, 302);
  const back = `${base}/e/${state.slug}/host`;

  const code = url.searchParams.get('code');
  if (!code) return Response.redirect(`${back}?google=denied`, 302);
  try {
    await saveFromCode(code);
    const event = await getEventBySlug(state.slug);
    after(() => syncEvent(event.id));
    return Response.redirect(`${back}?google=ok`, 302);
  } catch (err) {
    console.error('[party-playlist] google callback', err);
    return Response.redirect(`${back}?google=error`, 302);
  }
}
