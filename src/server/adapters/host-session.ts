// Design Ref: §7 host session — HMAC-signed cookie {eventId, exp}, httpOnly, 24 h.
import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const DAY_MS = 24 * 60 * 60 * 1000;
export const cookieName = (eventId: string) => `pp_host_${eventId.replace(/-/g, '')}`;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET must be at least 32 characters');
  return s;
}

export function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', secret()).update(body).digest('base64url');
  return `${body}.${mac}`;
}

export function unsign<T>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', secret()).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
  } catch {
    return null;
  }
}

export async function setHostSession(eventId: string): Promise<void> {
  const exp = Date.now() + DAY_MS;
  (await cookies()).set(cookieName(eventId), sign({ eventId, exp }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DAY_MS / 1000,
  });
}

export async function clearHostSession(eventId: string): Promise<void> {
  (await cookies()).delete(cookieName(eventId));
}

export async function isHost(eventId: string): Promise<boolean> {
  const token = (await cookies()).get(cookieName(eventId))?.value;
  const data = unsign<{ eventId: string; exp: number }>(token);
  return !!data && data.eventId === eventId && data.exp > Date.now();
}
