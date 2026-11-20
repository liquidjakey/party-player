// Design Ref: §4.1 POST /api/events, GET /api/e/[slug] — events are self-contained so the app is reusable (FR-01).
import 'server-only';
import { AppError } from '@/domain/errors';
import type { Guest, PartyEvent } from '@/domain/types';
import { db, must, toEvent, toGuest } from '../adapters/db';
import { hashPin, verifyAdminPin } from '../adapters/pin';

export interface CreateEventInput {
  adminPin: string;
  name: string;
  slug: string;
  guests: string[];
  hostPin: string;
  region: string;
}

export async function createEvent(input: CreateEventInput, ip: string): Promise<{ event: PartyEvent; guests: Guest[] }> {
  await verifyAdminPin(ip, input.adminPin);

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
    const rows = names.length
      ? must(
          await db()
            .from('guests')
            .insert(names.map((name) => ({ event_id: event.id, name })))
            .select(),
        )
      : [];
    return { event, guests: (rows ?? []).map(toGuest) };
  } catch (err) {
    await db().from('events').delete().eq('id', event.id); // cascade cleans the rest
    throw err;
  }
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
