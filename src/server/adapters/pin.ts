// Design Ref: §7 PIN rate limit — 5 wrong tries → 60 s lock, per (scope, IP). Scope = event id or 'admin'.
import 'server-only';
import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@/domain/errors';
import { db } from './db';

export const MAX_FAILS = 5;
export const MAX_PARTIES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;
export const LOCK_MS = 60_000;

export function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, 10);
}

/** Pure lock decision, unit-tested. */
export function lockDecision(fails: number, lockedUntil: string | null, now: number) {
  if (lockedUntil && Date.parse(lockedUntil) > now) return { locked: true } as const;
  return { locked: false, failsSoFar: lockedUntil ? 0 : fails } as const;
}

async function gate(scope: string, ip: string, check: () => Promise<boolean>): Promise<void> {
  const now = Date.now();
  const { data } = await db().from('pin_attempts').select('fails, locked_until').eq('scope', scope).eq('ip', ip).maybeSingle();
  const decision = lockDecision(data?.fails ?? 0, data?.locked_until ?? null, now);
  if (decision.locked) throw new AppError('PIN_LOCKED');

  if (await check()) {
    if (data) await db().from('pin_attempts').delete().eq('scope', scope).eq('ip', ip);
    return;
  }
  const fails = decision.failsSoFar + 1;
  const lockedUntil = fails >= MAX_FAILS ? new Date(now + LOCK_MS).toISOString() : null;
  await db()
    .from('pin_attempts')
    .upsert({ scope, ip, fails: lockedUntil ? 0 : fails, locked_until: lockedUntil }, { onConflict: 'scope,ip' });
  throw new AppError(lockedUntil ? 'PIN_LOCKED' : 'WRONG_PIN');
}

export function verifyEventPin(eventId: string, ip: string, pin: string, hash: string): Promise<void> {
  return gate(eventId, ip, () => bcrypt.compare(pin, hash));
}

/** Open site: an admin PIN is only needed when the site owner sets ADMIN_PIN. */
export function adminPinRequired(): boolean {
  return Boolean(process.env.ADMIN_PIN);
}

export function verifyAdminPin(ip: string, pin: string): Promise<void> {
  const expected = process.env.ADMIN_PIN;
  if (!expected) return Promise.resolve();
  return gate('admin', ip, async () => {
    const a = Buffer.from(pin);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

/**
 * Spam limit for the open site: at most MAX_PARTIES_PER_HOUR new parties per connection per hour.
 * Reuses pin_attempts with scope 'create': fails = parties made, locked_until = end of the hour window.
 */
export async function checkCreateRate(ip: string): Promise<void> {
  const now = Date.now();
  const { data } = await db().from('pin_attempts').select('fails, locked_until').eq('scope', 'create').eq('ip', ip).maybeSingle();
  const inWindow = data?.locked_until && Date.parse(data.locked_until) > now;
  const count = inWindow ? data!.fails : 0;
  if (count >= MAX_PARTIES_PER_HOUR) throw new AppError('TOO_MANY_PARTIES');
  await db()
    .from('pin_attempts')
    .upsert(
      { scope: 'create', ip, fails: count + 1, locked_until: inWindow ? data!.locked_until : new Date(now + HOUR_MS).toISOString() },
      { onConflict: 'scope,ip' },
    );
}
