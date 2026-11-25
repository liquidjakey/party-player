// Design Ref: §4.1 POST /api/events, GET /api/e/[slug] — events are self-contained so the app is reusable (FR-01).
import 'server-only';
import { AppError } from '@/domain/errors';
import type { Guest, PartyEvent } from '@/domain/types';
import { db, must, toEvent, toGuest } from '../adapters/db';
import { checkCreateRate, hashPin, verifyAdminPin } from '../adapters/pin';

export interface CreateEventInput {
  adminPin?: string;
  name: string;
  slug: string;
  guests: string[];
  hostPin: string;
  region: string;
}

export async function createEvent(input: CreateEventInput, ip: string): Promise<{ event: PartyEvent; guests: Guest[] }> {
  await verifyAdminPin(ip, input.adminPin ?? '');
  await checkCreateRate(ip);

  const res = await db()
    .from('events')
    .insert({ slug: input.slug, name: input.name, region: input.region })
    .select()
    .single();
  if (res.error?.code === '23505') throw new AppError('SLUG_TAKEN');
  const event = toEvent(must(res));

  try {
    must(await db().from('event_secrets').insert({ event_id: event.id, host_pin_hash: await hashPin(input.hostPin) }));
    must(await db().from('player_state').insert({ event_id: event.id }));
    const names = [...new Set(input.guests.map((g) => g.trim()).filter(Boolean))];
    return { event, guests: await insertGuests(event.id, names) };
  } catch (err) {
    await db().from('events').delete().eq('id', event.id); // cascade cleans the rest
    throw err;
  }
}

const COLORS = 5;

/** Least-used colors first (ties → lowest), so a party's guests stay as distinct as possible. */
export function pickColors(existing: (number | null)[], count: number): number[] {
  const used = Array.from({ length: COLORS }, (_, c) => existing.filter((x) => x === c).length);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const c = used.indexOf(Math.min(...used));
    used[c]++;
    out.push(c);
  }
  return out;
}

/** Insert guests with fixed colors. Falls back to no color if migration 0004 hasn't run yet. */
export async function insertGuests(eventId: string, names: string[]) {
  if (names.length === 0) return [];
  const existing = must(await db().from('guests').select('*').eq('event_id', eventId)) ?? [];
  const colors = pickColors(existing.map((g: { color?: number | null }) => g.color ?? null), names.length);
  const withColor = names.map((name, i) => ({ event_id: eventId, name, color: colors[i] }));
  let res = await db().from('guests').upsert(withColor, { onConflict: 'event_id,name', ignoreDuplicates: true }).select();
  if (res.error?.code === '42703' || res.error?.code === 'PGRST204') {
    res = await db()
      .from('guests')
      .upsert(names.map((name) => ({ event_id: eventId, name })), { onConflict: 'event_id,name', ignoreDuplicates: true })
      .select();
  }
  return (must(res) ?? []).map(toGuest);
}

export async function getEventBySlug(slug: string): Promise<PartyEvent> {
  const row = must(await db().from('events').select().eq('slug', slug).maybeSingle());
  if (!row) throw new AppError('EVENT_NOT_FOUND');
  return toEvent(row);
}

export async function getGuests(eventId: string): Promise<Guest[]> {
  const rows = must(await db().from('guests').select().eq('event_id', eventId).order('name'));
  return (rows ?? []).map(toGuest);
}

export async function getGuest(eventId: string, guestId: string): Promise<Guest> {
  const row = must(await db().from('guests').select().eq('id', guestId).eq('event_id', eventId).maybeSingle());
  if (!row) throw new AppError('GUEST_NOT_FOUND');
  return toGuest(row);
}
