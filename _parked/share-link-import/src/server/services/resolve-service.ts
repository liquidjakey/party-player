// Design Ref: §4.2 POST resolve — share link or typed name → up to 3 YouTube matches (FR-12, FR-13).
import 'server-only';
import { AppError } from '@/domain/errors';
import type { VideoMatch } from '@/domain/types';
import { checkQueueable } from '@/domain/video-rules';
import { db } from '../adapters/db';
import { youtube } from '../adapters/youtube-api';
import { extractUrl, resolveShareLink, type ResolveResult } from '../resolve';
import { getEventBySlug, getGuest } from './event-service';

const CACHE_DAYS = 30;

export interface ResolveOutput {
  source: { kind: string; service?: string; title?: string; artist?: string | null };
  matches: VideoMatch[];
}

async function cached<T>(key: string, make: () => Promise<T>): Promise<T> {
  const since = new Date(Date.now() - CACHE_DAYS * 86_400_000).toISOString();
  const hit = await db().from('resolve_cache').select('results').eq('key', key).gte('created_at', since).maybeSingle();
  if (hit.data) return hit.data.results as T;
  const value = await make();
  await db().from('resolve_cache').upsert({ key, results: value, created_at: new Date().toISOString() });
  return value;
}

async function search(query: string, region: string): Promise<VideoMatch[]> {
  const q = query.trim().replace(/\s+/g, ' ').slice(0, 120);
  const results = await cached(`q:${region}:${q.toLowerCase()}`, () => youtube().search(q, region));
  return results.slice(0, 3);
}

export async function resolveForGuest(
  slug: string,
  input: { guestId: string; url?: string; query?: string },
): Promise<ResolveOutput> {
  const event = await getEventBySlug(slug);
  await getGuest(event.id, input.guestId);

  if (input.query && !extractUrl(input.query)) {
    const matches = await search(input.query, event.region);
    return { source: { kind: 'query', title: input.query }, matches };
  }

  const link = input.url ?? input.query ?? '';
  const urlKey = extractUrl(link)?.split('#')[0] ?? link;
  const read = await cached<ResolveResult>(`u:${urlKey}`, () => resolveShareLink(link));

  if (read.kind === 'youtube') {
    const video = (await youtube().getVideos([read.videoId])).get(read.videoId) ?? null;
    const rule = checkQueueable(video, event.region);
    if (!rule.ok) throw new AppError(rule.code);
    const { videoId, title, channel, thumbUrl, durationSec } = video!;
    return { source: { kind: 'youtube' }, matches: [{ videoId, title, channel, thumbUrl, durationSec }] };
  }
  if (read.kind === 'unknown') {
    await db().from('resolve_cache').delete().eq('key', `u:${urlKey}`); // don't remember failures
    throw new AppError('RESOLVE_FAILED');
  }
  const query = [read.artist, read.title].filter(Boolean).join(' ');
  const matches = await search(query, event.region);
  return { source: { kind: 'song', service: read.service, title: read.title, artist: read.artist }, matches };
}
