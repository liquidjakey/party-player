// Design Ref: §4.1 GET /api/google/connect — host-only redirect to Google consent (FR-14).
import { randomBytes } from 'node:crypto';
import { connection } from 'next/server';
import { AppError } from '@/domain/errors';
import { authUrl, googleConfigured } from '@/server/adapters/google-oauth';
import { sign } from '@/server/adapters/host-session';
import { fail } from '@/server/http';
import { requireHost } from '@/server/require-host';

export async function GET(req: Request) {
  await connection(); // always run per request (never prerender)
  try {
    const slug = new URL(req.url).searchParams.get('slug') ?? '';
    await requireHost(slug);
    if (!googleConfigured()) throw new AppError('INTERNAL', undefined, 'YouTube backup is not set up on this site');
    const state = sign({ slug, nonce: randomBytes(12).toString('base64url'), exp: Date.now() + 10 * 60_000 });
    return Response.redirect(authUrl(state), 302);
  } catch (err) {
    return fail(err);
  }
}
