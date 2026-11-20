// Host-only routes: resolve the event and refuse without a valid host cookie.
import 'server-only';
import { AppError } from '@/domain/errors';
import type { PartyEvent } from '@/domain/types';
import { isHost } from './adapters/host-session';
import { getEventBySlug } from './services/event-service';

export async function requireHost(slug: string): Promise<PartyEvent> {
  const event = await getEventBySlug(slug);
  if (!(await isHost(event.id))) throw new AppError('UNAUTHORIZED');
  return event;
}
